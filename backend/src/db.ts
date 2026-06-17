import pg from "pg";

// TLS to hosted Postgres (Supabase pooler / Railway / Render). Set PGSSL=true in
// those environments; local Docker Postgres speaks no TLS, so leave it unset.
//
// Best practice is full verification: provide the provider's CA via PGCA (PEM
// string) and we verify against it. Without a CA we fall back to encrypted-but-
// unverified (rejectUnauthorized:false) — the common managed-PG default, which
// still encrypts in transit but does not protect against an active MITM. Supply
// PGCA in production to close that gap.
const ssl =
  process.env.PGSSL === "true"
    ? process.env.PGCA
      ? { ca: process.env.PGCA, rejectUnauthorized: true }
      : { rejectUnauthorized: false }
    : undefined;

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
});
