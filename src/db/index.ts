import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

/**
 * Direct Postgres client for server-side data access (Drizzle).
 * Uses the Supabase Postgres connection string — SERVER ONLY.
 * For Supabase client features (Auth/Storage/RLS) use lib/supabase/* instead.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
