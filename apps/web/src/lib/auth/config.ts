export type CoreloomAuthConfig = {
  baseUrl: string;
  cookieSecret: string;
};

export function readAuthConfig(
  baseUrl = process.env.NEON_AUTH_BASE_URL,
  cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET,
): CoreloomAuthConfig {
  if (!baseUrl) throw new Error("NEON_AUTH_BASE_URL is required");
  if (!cookieSecret) throw new Error("NEON_AUTH_COOKIE_SECRET is required");
  return { baseUrl, cookieSecret };
}
