import { pool } from "./db";
import { cleanCollage } from "./collage";
import { cleanPlanChoices } from "./plan";
import type { CleanEvent, EventInput } from "./validate";

export type EventRow = {
  id: string;
  title: string;
  description: string;
  event_date: string | null;
  event_time: string | null;
  time_zone: string | null;
  location: string;
  planning_headcount: number | null;
  budget_amount: string | null; // exact decimal, as text
  notes: string;
  status: "draft" | "published" | "cancelled";
  plan_version: number;
  collage: unknown; // jsonb; cleaned again before use
  plan_choices: unknown; // jsonb; cleaned again before use
};

// Dates and times are formatted in SQL so they never shift with a time zone.
const COLUMNS = `
  e.id, e.title, e.description,
  to_char(e.event_date, 'YYYY-MM-DD') as event_date,
  to_char(e.event_time, 'HH24:MI') as event_time,
  e.time_zone, e.location, e.planning_headcount,
  e.budget_amount::text as budget_amount,
  e.notes, e.status, e.plan_version, e.collage, e.plan_choices`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every event this person belongs to, newest changes first. */
export async function listEvents(userId: string): Promise<EventRow[]> {
  const { rows } = await pool.query(
    `select ${COLUMNS}
       from events e
       join event_members m on m.event_id = e.id
      where m.user_id = $1 and e.status <> 'cancelled'
      order by e.updated_at desc`,
    [userId],
  );
  return rows;
}

/** One event, only if this person is a member of it. Otherwise null. */
export async function getEvent(id: string, userId: string): Promise<EventRow | null> {
  if (!UUID.test(id)) return null;
  const { rows } = await pool.query(
    `select ${COLUMNS}
       from events e
       join event_members m on m.event_id = e.id
      where e.id = $1 and m.user_id = $2`,
    [id, userId],
  );
  return rows[0] ?? null;
}

/** Creates the event and its host membership together, or neither. */
export async function createEvent(userId: string, e: CleanEvent): Promise<{ id: string; version: number }> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `insert into events
         (host_id, title, description, event_date, event_time, time_zone,
          location, planning_headcount, budget_amount, notes, collage, plan_choices)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
       returning id, plan_version`,
      [userId, e.title, e.description, e.eventDate, e.eventTime, e.timeZone, e.location, e.headcount, e.budget, e.notes, JSON.stringify(e.collage), JSON.stringify(e.planChoices)],
    );
    await client.query(
      "insert into event_members (event_id, user_id, role) values ($1, $2, 'host')",
      [rows[0].id, userId],
    );
    await client.query("commit");
    return { id: rows[0].id, version: rows[0].plan_version };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Saves changes if the host is the owner AND nobody saved a newer version meanwhile.
 * Returns the new version number, or null if nothing was updated.
 */
export async function updateEvent(
  id: string,
  userId: string,
  expectedVersion: number,
  e: CleanEvent,
): Promise<number | null> {
  if (!UUID.test(id)) return null;
  const { rows } = await pool.query(
    `update events set
        title = $4, description = $5, event_date = $6, event_time = $7, time_zone = $8,
        location = $9, planning_headcount = $10, budget_amount = $11, notes = $12, collage = $13::jsonb, plan_choices = $14::jsonb,
        plan_version = plan_version + 1, updated_at = now()
      where id = $1 and host_id = $2 and plan_version = $3
      returning plan_version`,
    [id, userId, expectedVersion, e.title, e.description, e.eventDate, e.eventTime, e.timeZone, e.location, e.headcount, e.budget, e.notes, JSON.stringify(e.collage), JSON.stringify(e.planChoices)],
  );
  return rows[0]?.plan_version ?? null;
}

/** Turns a saved row back into form values. */
export function rowToInput(r: EventRow): EventInput {
  return {
    title: r.title,
    description: r.description,
    eventDate: r.event_date ?? "",
    eventTime: r.event_time ?? "",
    timeZone: r.time_zone ?? "",
    location: r.location,
    headcount: r.planning_headcount?.toString() ?? "",
    budget: r.budget_amount ?? "",
    notes: r.notes,
    collage: cleanCollage(r.collage),
    planChoices: cleanPlanChoices(r.plan_choices),
  };
}
