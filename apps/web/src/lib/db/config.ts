export function requireDatabaseUrl(value = process.env.DATABASE_URL): string {
  if (!value) throw new Error("DATABASE_URL is required");
  if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
    throw new Error("DATABASE_URL must start with postgresql:// or postgres://");
  }
  return value;
}
