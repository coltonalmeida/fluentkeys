import "./env.js";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { achievementsRouter } from "./achievements.js";
import { authRouter } from "./auth.js";
import { dailyRouter } from "./daily.js";
import { duelsRouter } from "./duels.js";
import { followsRouter } from "./follows.js";
import { jobsRouter } from "./jobs.js";
import { leaderboardRouter } from "./leaderboard.js";
import { profilesRouter } from "./profiles.js";
import { progressionRouter } from "./progression.js";
import { referralsRouter } from "./referrals.js";
import { resultsRouter } from "./results.js";
import { shareRouter } from "./share.js";
import { statsRouter } from "./stats.js";
import { tracesRouter } from "./traces.js";
import { trainingRouter } from "./training.js";
import { webhooksRouter } from "./webhooks.js";

const isProd = process.env.NODE_ENV === "production";
const app = express();
// Use `||` not `??`: an empty-string PORT (e.g. a blank env var on the host)
// would pass `??` and yield Number("") === 0, binding a random OS port.
const port = Number(process.env.PORT) || 3001;

// Behind Render/Railway/Vercel's proxy, so trust one hop for correct client IPs
// (rate limiting keys on them) and protocol.
app.set("trust proxy", 1);

// Security headers (nosniff, frameguard, HSTS, …). Safe for a JSON API.
app.use(helmet());

// CORS: in production CORS_ORIGIN must list the deployed frontend origin(s),
// comma-separated — fail closed rather than silently allowing any origin. In
// local dev (unset) we reflect the request origin.
const corsOrigins = process.env.CORS_ORIGIN?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
if (isProd && !corsOrigins?.length) {
  throw new Error("CORS_ORIGIN must be set in production");
}
app.use(cors({ origin: corsOrigins ?? true }));

// Clerk webhooks must be verified over the raw, unparsed body (Svix signs the
// exact bytes). Scope a raw parser to the webhook path so it runs before — and
// short-circuits — the global express.json below (which skips a request whose
// body a prior parser already consumed). Every other route still gets JSON.
app.use("/webhooks/clerk", express.raw({ type: "application/json", limit: "256kb" }));

// Bound request bodies: the largest legit payload is a training session
// (≤30 letters × 50 samples), comfortably under 256kb.
app.use(express.json({ limit: "256kb" }));
// Reads CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY from env.
app.use(clerkMiddleware());

// Global rate limit (per IP). Stricter per-route limiters live on the
// abuse-prone writes (username change, results/training posts).
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "fluentkeys-backend" });
});

app.use("/", webhooksRouter);
app.use("/auth", authRouter);

// Public + mixed routers FIRST. Several routers below apply requireSignedIn
// router-wide; because they're all mounted at "/", that middleware runs for
// every request passing through them and would 401 any public route mounted
// later. So all routers with public reads must precede the auth-gated ones.
// (Mixed routers guard their writes per-route, so their public GETs stay open.)
app.use("/", leaderboardRouter); // GET /leaderboard, /seasons
app.use("/", shareRouter); // GET /results/:id, /r/:id, /r/:id/card.png
app.use("/", tracesRouter); // GET /results/:id/trace (public) + POST (guarded)
app.use("/", profilesRouter); // GET /users/:username/profile
app.use("/", dailyRouter); // GET /daily, /daily/leaderboard (+ guarded POST)
app.use("/", duelsRouter); // GET /duels/:code (+ guarded POST)
app.use("/", jobsRouter); // /jobs/run (own secret guard), /email/unsubscribe

// Auth-gated routers (each applies requireSignedIn router-wide).
app.use("/", resultsRouter);
app.use("/", statsRouter);
app.use("/", trainingRouter);
app.use("/", achievementsRouter);
app.use("/", followsRouter);
app.use("/", progressionRouter);
app.use("/", referralsRouter);

// Catch-all error handler: log the real error server-side, return a generic
// message so stack traces / DB errors never reach the client. Honors an
// explicit status (e.g. ApiError) when one is set.
const errorHandler: ErrorRequestHandler = (err, _req, res: Response, _next: NextFunction) => {
  const status = typeof err?.status === "number" ? err.status : 500;
  if (status >= 500) console.error("Unhandled error:", err);
  res.status(status).json({ error: status >= 500 ? "Internal server error" : err.message });
};
app.use(errorHandler);

app.listen(port, "0.0.0.0", () => {
  console.log(`fluentkeys backend listening on port ${port}`);
});
