import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { requireDatabaseUrl } from "@/lib/db/config";
import * as schema from "@/lib/db/schema";

export function createDatabase() {
  return drizzle({ client: neon(requireDatabaseUrl()), schema });
}
