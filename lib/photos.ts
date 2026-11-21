import { pool } from "./db";
import { MAX_PHOTOS, type Photo } from "./collage";

export const MAX_PHOTO_BYTES = 1_500_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID.test(s);

/** The photos on one event, oldest first. Empty unless this person is a member of it. */
export async function listPhotos(eventId: string, userId: string): Promise<Photo[]> {
  if (!isUuid(eventId)) return [];
  const { rows } = await pool.query(
    `select p.id, p.width as w, p.height as h
       from event_photos p
       join event_members m on m.event_id = p.event_id
      where p.event_id = $1 and m.user_id = $2
      order by p.created_at, p.id`,
    [eventId, userId],
  );
  return rows;
}

/**
 * Adds a photo if this person is a member and the board isn't full.
 * Returns the new photo, or null if either check failed.
 */
export async function addPhoto(
  eventId: string,
  userId: string,
  data: Buffer,
  w: number,
  h: number,
): Promise<Photo | null> {
  if (!isUuid(eventId)) return null;
  const { rows } = await pool.query(
    `insert into event_photos (event_id, data, width, height)
     select $1::uuid, $2::bytea, $3::int, $4::int
      where exists (select 1 from event_members where event_id = $1::uuid and user_id = $5::uuid)
        and (select count(*) from event_photos where event_id = $1::uuid) < $6::int
     returning id, width as w, height as h`,
    [eventId, data, w, h, userId, MAX_PHOTOS],
  );
  return rows[0] ?? null;
}

/** The image bytes, only for a member of the event the photo belongs to. */
export async function getPhotoData(photoId: string, userId: string): Promise<Buffer | null> {
  if (!isUuid(photoId)) return null;
  const { rows } = await pool.query(
    `select p.data
       from event_photos p
       join event_members m on m.event_id = p.event_id
      where p.id = $1 and m.user_id = $2`,
    [photoId, userId],
  );
  return rows[0]?.data ?? null;
}

export async function deletePhoto(photoId: string, userId: string): Promise<boolean> {
  if (!isUuid(photoId)) return false;
  const { rowCount } = await pool.query(
    `delete from event_photos p
      using event_members m
      where p.id = $1 and m.event_id = p.event_id and m.user_id = $2`,
    [photoId, userId],
  );
  return (rowCount ?? 0) > 0;
}
