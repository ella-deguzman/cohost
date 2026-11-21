import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanEvent, cleanup, dbEnabled, loadApp, makeUser } from "./helpers";

describe.skipIf(!dbEnabled)("events, with a real database", () => {
  let app: Awaited<ReturnType<typeof loadApp>>;
  let owner: string;
  let stranger: string;

  beforeAll(async () => {
    app = await loadApp();
    owner = await makeUser(app.pool, "event-owner");
    stranger = await makeUser(app.pool, "event-stranger");
  });
  afterAll(async () => {
    if (app) await cleanup(app.pool);
  });

  it("makes the creator the host, so they can find their event", async () => {
    const { id, version } = await app.createEvent(owner, cleanEvent({ title: "Host test" }));
    expect(version).toBe(1);

    const { rows } = await app.pool.query("select role from event_members where event_id = $1 and user_id = $2", [id, owner]);
    expect(rows[0]?.role).toBe("host");
    expect((await app.listEvents(owner)).map((e) => e.id)).toContain(id);
  });

  it("hides an event from people who aren't members, as if it didn't exist", async () => {
    const { id } = await app.createEvent(owner, cleanEvent({ title: "Private" }));

    expect(await app.getEvent(id, owner)).not.toBeNull();
    expect(await app.getEvent(id, stranger)).toBeNull();
    expect((await app.listEvents(stranger)).map((e) => e.id)).not.toContain(id);
    expect(await app.getEvent("not-a-uuid", owner)).toBeNull();
  });

  it("saves exact values and gives them back as the form expects", async () => {
    const { id } = await app.createEvent(
      owner,
      cleanEvent({
        title: "Round trip",
        budget: "300.50",
        headcount: "12",
        eventDate: "2026-12-24",
        eventTime: "19:30",
        collage: { occasion: "Birthday", vibes: ["Cozy"], pos: { title: { x: 0.2, y: 0.3, r: -2 } } },
      }),
    );
    const input = app.rowToInput((await app.getEvent(id, owner))!);

    expect(input).toMatchObject({
      title: "Round trip",
      budget: "300.50",
      headcount: "12",
      eventDate: "2026-12-24",
      eventTime: "19:30",
    });
    expect(input.collage).toEqual({ occasion: "Birthday", vibes: ["Cozy"], pos: { title: { x: 0.2, y: 0.3, r: -2 } } });
  });

  it("protects against two open tabs overwriting each other (version check)", async () => {
    const { id, version } = await app.createEvent(owner, cleanEvent({ title: "Versioned" }));

    const v2 = await app.updateEvent(id, owner, version, cleanEvent({ title: "Second save" }));
    expect(v2).toBe(version + 1);

    // A tab still holding the old version is refused, and nothing is overwritten.
    expect(await app.updateEvent(id, owner, version, cleanEvent({ title: "Stale save" }))).toBeNull();
    expect((await app.getEvent(id, owner))!.title).toBe("Second save");
  });

  it("only lets the host change an event", async () => {
    const { id, version } = await app.createEvent(owner, cleanEvent({ title: "Mine" }));

    expect(await app.updateEvent(id, stranger, version, cleanEvent({ title: "Hijacked" }))).toBeNull();
    expect((await app.getEvent(id, owner))!.title).toBe("Mine");
  });

  it("hides cancelled events from the list", async () => {
    const { id } = await app.createEvent(owner, cleanEvent({ title: "Cancelled" }));
    await app.pool.query("update events set status = 'cancelled' where id = $1", [id]);

    expect((await app.listEvents(owner)).map((e) => e.id)).not.toContain(id);
  });
});
