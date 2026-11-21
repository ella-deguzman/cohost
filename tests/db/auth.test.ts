import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, dbEnabled, loadApp, testEmail } from "./helpers";

describe.skipIf(!dbEnabled)("sign-in, with a real database", () => {
  let app: Awaited<ReturnType<typeof loadApp>>;

  beforeAll(async () => {
    app = await loadApp();
  });
  afterAll(async () => {
    if (app) await cleanup(app.pool);
  });

  it("works once: a sign-in link can't be used twice", async () => {
    const email = testEmail("once");
    const token = await app.createLoginToken(email);
    expect(token).toBeTruthy();

    expect(await app.consumeLoginToken(token!)).toBe(email);
    expect(await app.consumeLoginToken(token!)).toBeNull();
  });

  it("rejects tokens that were never issued", async () => {
    expect(await app.consumeLoginToken("made-up-token")).toBeNull();
    expect(await app.consumeLoginToken("")).toBeNull();
  });

  it("rejects expired links", async () => {
    const email = testEmail("expired");
    const token = await app.createLoginToken(email);
    await app.pool.query("update login_tokens set expires_at = now() - interval '1 minute' where email = $1", [email]);

    expect(await app.consumeLoginToken(token!)).toBeNull();
  });

  it("stops asking for links after 5 in an hour", async () => {
    const email = testEmail("ratelimit");
    for (let i = 0; i < 5; i++) expect(await app.createLoginToken(email)).toBeTruthy();

    expect(await app.createLoginToken(email)).toBeNull();
  });

  it("creates one user per email, with a separate session each time they sign in", async () => {
    const email = testEmail("sessions");
    const a = await app.startSession(email);
    const b = await app.startSession(email);
    expect(a).not.toBe(b);

    const users = await app.pool.query("select id from users where email = $1", [email]);
    expect(users.rows).toHaveLength(1);
    const sessions = await app.pool.query("select 1 from sessions where user_id = $1", [users.rows[0].id]);
    expect(sessions.rows).toHaveLength(2);
  });

  it("never stores the sign-in token itself, only a hash", async () => {
    const email = testEmail("hashed");
    const token = await app.createLoginToken(email);
    const { rows } = await app.pool.query("select token_hash from login_tokens where email = $1", [email]);

    expect(rows[0].token_hash).not.toBe(token);
    expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
