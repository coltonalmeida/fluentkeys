import { Router, type Request, type Response, type NextFunction } from "express";
import { Webhook } from "svix";
import { pool } from "./db.js";

// Clerk signs webhooks with Svix; the signing secret is per-endpoint and comes
// from the Clerk Dashboard (Webhooks → your endpoint → Signing Secret).
const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

// Express 4 doesn't catch async errors; wrap handlers that hit the DB.
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Minimal shape of the Clerk events we act on. We only need the deleted user's
 *  Clerk id; the rest of the payload is ignored. */
interface ClerkWebhookEvent {
  type: string;
  data: { id?: string };
}

export const webhooksRouter = Router();

// Clerk → backend webhook. Mounted with a RAW body parser (see index.ts) because
// Svix signature verification must run over the exact bytes Clerk sent; a parsed
// body would change them and fail verification.
//
// On `user.deleted` we wipe the user's data so a Clerk-side account deletion
// removes everything we hold. FK cascades cover personal_bests, leaderboard
// entries, follows, achievements, and the training tables; results and
// test_sessions are ON DELETE SET NULL, so we delete those explicitly first.
webhooksRouter.post(
  "/webhooks/clerk",
  wrap(async (req, res) => {
    if (!SIGNING_SECRET) {
      // Misconfiguration: refuse rather than silently accepting unverified posts.
      console.error("CLERK_WEBHOOK_SIGNING_SECRET is not set; rejecting webhook");
      res.status(500).json({ error: "Webhook not configured" });
      return;
    }

    // express.raw gives us a Buffer; Svix wants the raw string payload.
    const payload = req.body instanceof Buffer ? req.body.toString("utf8") : "";
    let evt: ClerkWebhookEvent;
    try {
      evt = new Webhook(SIGNING_SECRET).verify(payload, {
        "svix-id": req.header("svix-id") ?? "",
        "svix-timestamp": req.header("svix-timestamp") ?? "",
        "svix-signature": req.header("svix-signature") ?? "",
      }) as ClerkWebhookEvent;
    } catch {
      // Bad/forged signature or replay — never process it.
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    if (evt.type === "user.deleted") {
      const clerkId = evt.data.id;
      if (clerkId) await deleteUserByClerkId(clerkId);
    }

    // Ack everything else so Clerk doesn't retry events we don't handle.
    res.status(200).json({ received: true });
  }),
);

/** Remove all data for a Clerk identity. Idempotent: a missing user is a no-op,
 *  so Clerk retries (or a delete that races our own cleanup) stay safe. */
async function deleteUserByClerkId(clerkId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE clerk_id = $1",
      [clerkId],
    );
    const userId = rows[0]?.id;
    if (userId) {
      // SET NULL columns must be cleared explicitly to truly remove the rows.
      await client.query("DELETE FROM results WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM test_sessions WHERE user_id = $1", [userId]);
      // Deleting the user cascades personal_bests, leaderboard_entries, follows,
      // achievements, training_profiles, letter_strengths, training_sessions.
      await client.query("DELETE FROM users WHERE id = $1", [userId]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
