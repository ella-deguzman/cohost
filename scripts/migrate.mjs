// Creates the database tables. Run with: npm run db:migrate
import { readFileSync } from "node:fs";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env.local first.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
  console.log("Database is ready.");
} catch (err) {
  console.error("Could not set up the database:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
