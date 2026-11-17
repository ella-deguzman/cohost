import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "./db";

export const SESSION_COOKIE = "cohost_session";
export const SESSION_DAYS = 30;

// We store only a hash of each token, so a leaked database can't be used to sign in.
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

/** Creates a one-time sign-in token. Returns null if this email asked too often. */
export async function createLoginToken(email: string): Promise<string | null> {
  const { rows } = await pool.query(
    `select count(*)::int as n from login_tokens
      where email = $1 and created_at > now() - interval '1 hour'`,
    [email],
  );
  if (rows[0].n >= 5) return null;

  const token = newToken();
  await pool.query(
    `insert into login_tokens (token_hash, email, expires_at)
     values ($1, $2, now() + interval '15 minutes')`,
    [hash(token), email],
  );
  return token;
}

/** Marks a sign-in token as used. Returns the email, or null if invalid/expired/used. */
export async function consumeLoginToken(token: string): Promise<string | null> {
  const { rows } = await pool.query(
    `update login_tokens set used_at = now()
      where token_hash = $1 and used_at is null and expires_at > now()
      returning email`,
    [hash(token)],
  );
  return rows[0]?.email ?? null;
}

/** Finds or creates the user, then starts a session. Returns the raw session token. */
export async function startSession(email: string): Promise<string> {
  const user = await pool.query(
    `insert into users (email) values ($1)
     on conflict (email) do update set email = excluded.email
     returning id`,
    [email],
  );
  const token = newToken();
  await pool.query(
    `insert into sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + make_interval(days => $3))`,
    [hash(token), user.rows[0].id, SESSION_DAYS],
  );
  return token;
}

export type CurrentUser = { id: string; email: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { rows } = await pool.query(
    `select u.id, u.email from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hash(token)],
  );
  return rows[0] ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await pool.query("delete from sessions where token_hash = $1", [hash(token)]);
  jar.delete(SESSION_COOKIE);
}
