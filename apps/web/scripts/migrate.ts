import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { requireDatabaseUrl } from "../src/lib/db/config";
import { assertDevelopmentTarget, describeDatabaseTarget, DATABASE_HOST_ENV } from "../src/lib/db/migrate";

async function run() {
  const databaseUrl = requireDatabaseUrl();
  assertDevelopmentTarget({
    branch: process.env.CORELOOM_DATABASE_BRANCH,
    databaseUrl,
    allowedHost: process.env[DATABASE_HOST_ENV],
  });
  // 어디에 쓰는지 눈으로 보이게 남긴다. 조용히 도는 것이 사고의 절반이다.
  console.log(`마이그레이션 대상: ${describeDatabaseTarget(databaseUrl)}`);
  const database = drizzle({ client: neon(databaseUrl) });
  await migrate(database, { migrationsFolder: "drizzle" });
  console.log("마이그레이션 완료");
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Migration failed";
  console.error(message);
  process.exitCode = 1;
});
