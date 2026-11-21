import type { Pool } from "pg";
import { EMPTY_EVENT, validate, type CleanEvent, type EventInput } from "@/lib/validate";
import { assertTestDb } from "./guard";

export { assertTestDb };

// Database tests run only when TEST_DATABASE_URL is set, and only against a database
// whose name contains "test", so they can never touch your real event data.
export const TEST_URL = process.env.TEST_DATABASE_URL;
export const dbEnabled = Boolean(TEST_URL);

/** Loads the app's own code, pointed at the test database. */
export async function loadApp() {
  if (!TEST_URL) throw new Error("TEST_DATABASE_URL is not set");
  assertTestDb(TEST_URL);
  process.env.DATABASE_URL = TEST_URL;
  const [{ pool }, events, photos, auth] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/events"),
    import("@/lib/photos"),
    import("@/lib/auth"),
  ]);
  return { pool, ...events, ...photos, ...auth };
}

// Every run uses its own email addresses, so runs never collide, and cleanup removes only those.
const runId = Math.random().toString(36).slice(2, 8);
export const testEmail = (name: string) => `it-${runId}-${name}@example.test`;

export async function makeUser(pool: Pool, name: string): Promise<string> {
  const { rows } = await pool.query("insert into users (email) values ($1) returning id", [testEmail(name)]);
  return rows[0].id;
}

export async function cleanup(pool: Pool) {
  const like = `it-${runId}-%`;
  await pool.query("delete from events where host_id in (select id from users where email like $1)", [like]);
  await pool.query("delete from login_tokens where email like $1", [like]);
  await pool.query("delete from users where email like $1", [like]); // sessions go with them
  // Close the connections so the test run can finish, and let the next file start a fresh pool.
  await pool.end();
  delete (globalThis as { pgPool?: unknown }).pgPool;
}

export function cleanEvent(over: Partial<EventInput> = {}): CleanEvent {
  const r = validate({ ...EMPTY_EVENT, title: "Test dinner", ...over });
  if (!("value" in r)) throw new Error(r.error);
  return r.value;
}
