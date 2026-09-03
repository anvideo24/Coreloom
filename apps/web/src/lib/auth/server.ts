import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

import { readAuthConfig } from "@/lib/auth/config";

export function createCoreloomAuth() {
  const config = readAuthConfig();
  return createNeonAuth({
    baseUrl: config.baseUrl,
    cookies: { secret: config.cookieSecret, sameSite: "lax" },
  });
}
