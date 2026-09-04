/** Postgres undefined_table (42P01) and drizzle/neon wrappers around it. */
export function isUndefinedRelationError(error: unknown, relationName: string): boolean {
  const needle = `relation "${relationName}" does not exist`;
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (typeof current !== "object") break;
    const record = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
      sourceError?: unknown;
    };
    const message = typeof record.message === "string" ? record.message : "";
    if (message.includes(needle)) return true;
    if (record.code === "42P01" && message.includes(relationName)) return true;
    current = record.cause ?? record.sourceError;
  }

  return false;
}
