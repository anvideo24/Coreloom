import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { validateReadRoot, searchReadFiles, readAllowedFile } from "@/lib/agents/read-files";

const temporary: string[] = [];
// Windows TEMP lives under protected AppData. Fixtures belong to a normal workspace folder.
async function fixture() { const root = await mkdtemp(path.join(process.cwd(), "agent-read-test-")); temporary.push(root); return root; }
afterEach(async () => { for (const root of temporary.splice(0)) await rm(root, { recursive: true, force: true }); });
describe("PC read sandbox", () => {
  it("rejects broad roots and credentials directories", async () => {
    await expect(validateReadRoot(path.parse(process.cwd()).root)).rejects.toThrow();
    await expect(validateReadRoot(path.dirname(homedir()))).rejects.toThrow();
    const root = await fixture(); await mkdir(path.join(root, ".ssh"));
    await expect(validateReadRoot(path.join(root, ".ssh"))).rejects.toThrow();
  });
  it("reads and searches normal text but not env, auth files, or traversal", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "brief.md"), "synthetic document");
    await writeFile(path.join(root, ".env"), "PRIVATE=value");
    await writeFile(path.join(root, "auth.json"), "{}");
    const files = await searchReadFiles([root], "");
    expect(files.rows.map((r) => r.path)).toEqual(["brief.md"]);
    expect((await readAllowedFile([root], 0, "brief.md")).text).toBe("synthetic document");
    await expect(readAllowedFile([root], 0, "../outside.md")).rejects.toThrow();
    await expect(readAllowedFile([root], 0, "auth.json")).rejects.toThrow();
  });
  it("does not traverse junctions and blocks secret-looking contents", async () => {
    const root = await fixture(), outside = await fixture();
    await writeFile(path.join(outside, "hidden.md"), "outside");
    await symlink(outside, path.join(root, "linked"), process.platform === "win32" ? "junction" : "dir");
    await writeFile(path.join(root, "notes.txt"), "password=synthetic-secret");
    expect((await searchReadFiles([root], "hidden")).rows).toEqual([]);
    await expect(readAllowedFile([root], 0, "linked/hidden.md")).rejects.toThrow();
    await expect(readAllowedFile([root], 0, "notes.txt")).rejects.toThrow();
  });
});
