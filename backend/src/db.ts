import pg from "pg";

// Hosted Postgres (Railway/Render) requires TLS but uses certs that don't
// verify against public CAs, hence rejectUnauthorized: false. Local Docker
// Postgres speaks no TLS at all, so SSL stays off unless PGSSL=true.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});
