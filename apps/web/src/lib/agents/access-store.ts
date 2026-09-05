import "server-only";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { validateReadRoot } from "./read-files";

function accessFile(workspace: string, agent: string) {
  z.string().uuid().parse(workspace); z.string().uuid().parse(agent);
  return path.join(process.env.LOCALAPPDATA || path.join(homedir(), ".local/share"), "Coreloom", "agent-access", `${workspace}-${agent}.json`);
}
export async function readAgentRoots(workspace: string, agent: string): Promise<string[]> {
  try { return z.array(z.string()).max(8).parse(JSON.parse(await readFile(accessFile(workspace, agent), "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw new Error("PC 폴더 설정을 읽지 못했습니다."); }
}
export async function saveAgentRoots(workspace: string, agent: string, roots: string[]) {
  const values = await Promise.all(z.array(z.string().trim().min(1).max(500)).max(8).parse(roots).map(validateReadRoot));
  const destination = accessFile(workspace, agent);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify([...new Set(values)]), { mode: 0o600, flag: "wx" });
  await rename(temporary, destination);
}
