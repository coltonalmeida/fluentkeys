import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Env lives in the repo root, one level above backend/.
// This module must be imported before anything that reads process.env.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
