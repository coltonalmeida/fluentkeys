import "./env.js";
import cors from "cors";
import express from "express";
import { authRouter } from "./auth.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "fluentkeys-backend" });
});

app.use("/auth", authRouter);

app.listen(port, () => {
  console.log(`fluentkeys backend listening on http://localhost:${port}`);
});
