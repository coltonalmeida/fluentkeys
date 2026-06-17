import "./env.js";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express from "express";
import { achievementsRouter } from "./achievements.js";
import { authRouter } from "./auth.js";
import { followsRouter } from "./follows.js";
import { leaderboardRouter } from "./leaderboard.js";
import { resultsRouter } from "./results.js";
import { statsRouter } from "./stats.js";
import { trainingRouter } from "./training.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

// In production CORS_ORIGIN must list the deployed frontend origin(s),
// comma-separated. Unset = allow all (local dev).
const corsOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors(corsOrigins ? { origin: corsOrigins } : undefined));
app.use(express.json());
// Reads CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY from env.
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "fluentkeys-backend" });
});

app.use("/auth", authRouter);
app.use("/", leaderboardRouter);
app.use("/", resultsRouter);
app.use("/", statsRouter);
app.use("/", trainingRouter);
app.use("/", achievementsRouter);
app.use("/", followsRouter);

app.listen(port, "0.0.0.0", () => {
  console.log(`fluentkeys backend listening on port ${port}`);
});
