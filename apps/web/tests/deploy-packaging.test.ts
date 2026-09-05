import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = join(__dirname, "..");
const repoRoot = join(webRoot, "../..");

describe("deploy packaging", () => {
  it("enables Next standalone output and keeps secrets out of the trace", () => {
    const config = readFileSync(join(webRoot, "next.config.ts"), "utf8");
    expect(config).toContain('output: "standalone"');
    expect(config).toContain("outputFileTracingRoot");
    expect(config).toContain("**/.env*");
    expect(config).toContain("../../manual/**/*.md");
    expect(config).toContain("../../docs/superpowers/plans/*.md");
    expect(config).toContain("../../docs/quality/*.json");
  });

  it("ships a root Dockerfile that starts apps/web/server.js", () => {
    const dockerfile = readFileSync(join(repoRoot, "Dockerfile"), "utf8");
    expect(dockerfile).toContain("npm run build");
    expect(dockerfile).toContain(".next/standalone");
    expect(dockerfile).toContain('CMD ["node", "apps/web/server.js"]');
    expect(dockerfile).not.toMatch(/COPY[^\n]*\.env/);
    expect(existsSync(join(repoRoot, ".dockerignore"))).toBe(true);
    expect(existsSync(join(repoRoot, "docs/operations/deploy-packaging.md"))).toBe(true);
  });
});
