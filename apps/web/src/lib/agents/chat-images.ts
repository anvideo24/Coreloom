import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { normalizeChatImage } from "./chat-image-codec";

function directory(actor: string, agentId: string) {
  const owner = createHash("sha256").update(`${actor}:${agentId}`).digest("hex");
  return path.join(process.env.LOCALAPPDATA || path.join(homedir(), ".local/share"), "Coreloom", "chat-images", owner);
}
// Caller must authorize the active agent before calling. No client paths or filenames are accepted.
export async function storeChatImage(actor: string, agentId: string, bytes: Buffer) {
  const normalized = await normalizeChatImage(bytes);
  const folder = directory(actor, agentId);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  if ((await readdir(folder)).length >= 256) throw new Error("이 에이전트의 이미지 보관 한도에 도달했습니다.");
  const id = randomUUID();
  await writeFile(path.join(folder, `${id}.webp`), normalized, { flag: "wx", mode: 0o600 });
  return { id };
}
export async function readChatImage(actor: string, agentId: string, id: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) throw new Error("잘못된 이미지입니다.");
  return readFile(path.join(directory(actor, agentId), `${id}.webp`));
}
