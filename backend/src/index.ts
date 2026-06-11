import "./env.js";
import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express from "express";
import { authRouter } from "./auth.js";
import { resultsRouter } from "./results.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());
// Reads CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY from env.
app.use(clerkMiddleware());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "fluentkeys-backend" });
});

app.use("/auth", authRouter);
app.use("/", resultsRouter);

app.listen(port, () => {
  console.log(`fluentkeys backend listening on http://localhost:${port}`);
});
