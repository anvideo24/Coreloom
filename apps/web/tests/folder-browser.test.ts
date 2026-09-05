import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/agents/read-files", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/read-files")>("@/lib/agents/read-files");
  return { ...actual, validateReadRoot: vi.fn(async (value: string) => value), noLinks: vi.fn(), safeParts: (value: string) => value.includes("coreloom-folder-fixture-") || value.split(/[\\/]+/).every((part) => !/^(?:\..*|node_modules|appdata|windows)$/i.test(part)) };
});
import { browseAgentFolders } from "@/lib/agents/folder-browser";

let fixture = "";

describe("agent folder browser", () => {
  beforeAll(async () => {
    fixture = await mkdtemp(path.join(os.tmpdir(), "coreloom-folder-fixture-"));
    await mkdir(path.join(fixture, "visible", "child"), { recursive: true });
    await mkdir(path.join(fixture, ".hidden"), { recursive: true });
    await mkdir(path.join(fixture, "node_modules"), { recursive: true });
  });
  afterAll(async () => {
    const target = path.resolve(fixture);
    if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith("coreloom-folder-fixture-")) {
      throw new Error("Unsafe fixture cleanup target");
    }
    await rm(target, { recursive: true, force: true });
  });

  it("returns direct visible folders and a selectable child", async () => {
    const result = await browseAgentFolders(fixture);
    expect(result.currentPath).toBe(fixture);
    expect(result.canSelect).toBe(true);
    expect(result.entries).toEqual([{ name: "visible", path: path.join(fixture, "visible") }]);
    expect(result.entries[0]?.path).not.toContain(".hidden");
  });

  it("does not select the server home", async () => {
    vi.spyOn(os, "homedir").mockReturnValue(fixture);
    const result = await browseAgentFolders(fixture);
    expect(result.canSelect).toBe(false);
    expect(result.parentPath).toBeNull();
    vi.restoreAllMocks();
  });

  it("truncates at 100 folders", async () => {
    await Promise.all(Array.from({ length: 105 }, (_, index) => mkdir(path.join(fixture, `folder-${index}`))));
    const result = await browseAgentFolders(fixture);
    expect(result.entries).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });

  it("counts inspected entries, including files, toward the 1000 limit", async () => {
    const files = path.join(fixture, "many-files");
    await mkdir(files);
    await Promise.all(Array.from({ length: 1005 }, (_, index) => writeFile(path.join(files, `file-${index}.txt`), "x")));
    const result = await browseAgentFolders(files);
    expect(result.entries).toEqual([]);
    expect(result.truncated).toBe(true);
  });
});
