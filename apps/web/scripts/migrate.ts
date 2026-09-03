import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { requireDatabaseUrl } from "../src/lib/db/config";
import { assertDevelopmentTarget } from "../src/lib/db/migrate";

async function run() {
  assertDevelopmentTarget();
  const database = drizzle({ client: neon(requireDatabaseUrl()) });
  await migrate(database, { migrationsFolder: "drizzle" });
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Migration failed";
  console.error(message);
  process.exitCode = 1;
});
