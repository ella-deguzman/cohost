import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_PHOTOS } from "@/lib/collage";
import { cleanEvent, cleanup, dbEnabled, loadApp, makeUser } from "./helpers";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

describe.skipIf(!dbEnabled)("photos, with a real database", () => {
  let app: Awaited<ReturnType<typeof loadApp>>;
  let owner: string;
  let stranger: string;

  beforeAll(async () => {
    app = await loadApp();
    owner = await makeUser(app.pool, "photo-owner");
    stranger = await makeUser(app.pool, "photo-stranger");
  });
  afterAll(async () => {
    if (app) await cleanup(app.pool);
  });

  const newEvent = async () => (await app.createEvent(owner, cleanEvent())).id;

  it("lets the owner add, list, view and delete a photo", async () => {
    const eventId = await newEvent();
    const photo = await app.addPhoto(eventId, owner, jpeg, 900, 600);
    expect(photo).not.toBeNull();
    expect(photo).toMatchObject({ w: 900, h: 600 });

    expect(await app.listPhotos(eventId, owner)).toHaveLength(1);
    expect((await app.getPhotoData(photo!.id, owner))?.equals(jpeg)).toBe(true);

    expect(await app.deletePhoto(photo!.id, owner)).toBe(true);
    expect(await app.listPhotos(eventId, owner)).toHaveLength(0);
  });

  it("keeps everyone else out: no adding, listing, viewing or deleting", async () => {
    const eventId = await newEvent();
    const photo = await app.addPhoto(eventId, owner, jpeg, 100, 100);

    expect(await app.addPhoto(eventId, stranger, jpeg, 100, 100)).toBeNull();
    expect(await app.listPhotos(eventId, stranger)).toEqual([]);
    expect(await app.getPhotoData(photo!.id, stranger)).toBeNull();
    expect(await app.deletePhoto(photo!.id, stranger)).toBe(false);

    // ...and the owner's photo is still there.
    expect(await app.listPhotos(eventId, owner)).toHaveLength(1);
  });

  it("lets a co-host (any member of the event) see its photos", async () => {
    const eventId = await newEvent();
    const photo = await app.addPhoto(eventId, owner, jpeg, 100, 100);
    await app.pool.query("insert into event_members (event_id, user_id, role) values ($1, $2, 'cohost')", [eventId, stranger]);

    expect(await app.listPhotos(eventId, stranger)).toHaveLength(1);
    expect(await app.getPhotoData(photo!.id, stranger)).not.toBeNull();
  });

  it(`refuses a photo past the limit of ${MAX_PHOTOS}, and frees room after a delete`, async () => {
    const eventId = await newEvent();
    const added = [];
    for (let i = 0; i < MAX_PHOTOS + 3; i++) added.push(await app.addPhoto(eventId, owner, jpeg, 100, 100));

    expect(added.filter(Boolean)).toHaveLength(MAX_PHOTOS);
    expect(await app.listPhotos(eventId, owner)).toHaveLength(MAX_PHOTOS);

    await app.deletePhoto(added[0]!.id, owner);
    expect(await app.addPhoto(eventId, owner, jpeg, 100, 100)).not.toBeNull();
  });

  it("doesn't crash on malformed ids", async () => {
    expect(await app.listPhotos("nope", owner)).toEqual([]);
    expect(await app.addPhoto("nope", owner, jpeg, 1, 1)).toBeNull();
    expect(await app.getPhotoData("nope", owner)).toBeNull();
    expect(await app.deletePhoto("nope", owner)).toBe(false);
  });

  it("deletes a photo's data when its event is deleted", async () => {
    const eventId = await newEvent();
    const photo = await app.addPhoto(eventId, owner, jpeg, 100, 100);
    await app.pool.query("delete from events where id = $1", [eventId]);

    const { rows } = await app.pool.query("select 1 from event_photos where id = $1", [photo!.id]);
    expect(rows).toHaveLength(0);
  });
});
