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

/**
 * Postgres unique_violation (23505) for a *specific named* unique index/constraint, and
 * drizzle/neon wrappers around it (they nest the real driver error under `cause` or
 * `sourceError`, same as `isUndefinedRelationError` above).
 *
 * The index name must match — checking only `code === "23505"` would also swallow violations
 * of unrelated unique constraints (e.g. a duplicate client company name) as if they were a
 * duplicate submission, silently hiding a real error from the caller.
 */
export function isUniqueViolationError(error: unknown, indexName: string): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (typeof current !== "object") break;
    const record = current as {
      code?: unknown;
      message?: unknown;
      constraint?: unknown;
      cause?: unknown;
      sourceError?: unknown;
    };
    const message = typeof record.message === "string" ? record.message : "";
    const constraint = typeof record.constraint === "string" ? record.constraint : "";
    const mentionsIndex = constraint === indexName || message.includes(indexName);
    if (record.code === "23505" && mentionsIndex) return true;
    current = record.cause ?? record.sourceError;
  }

  return false;
}
