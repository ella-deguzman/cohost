import { readFileSync } from "node:fs";
import pg from "pg";
import { assertTestDb } from "./guard";

/** Runs once before all tests: creates the tables in the test database (safe to repeat). */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return; // no test database: the database tests skip themselves
  assertTestDb(url);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8"));
  } finally {
    await client.end();
  }
}
