export function assertDevelopmentTarget(branch = process.env.CORELOOM_DATABASE_BRANCH): void {
  if (branch !== "ai-development") {
    throw new Error("Migration target must be the ai-development branch");
  }
}
