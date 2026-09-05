"use server";

import { z } from "zod";

import { chatAgent } from "@/lib/agents/chat-repository";
import { browseAgentFolders } from "@/lib/agents/folder-browser";
import { founderSession } from "@/lib/auth/session";

export async function browseAgentFoldersAction(agentId: string, folder: string | null) {
  const session = await founderSession();
  if (session.state !== "authorized") throw new Error("Founder access is required");
  const id = z.string().uuid().parse(agentId);
  const current = z.string().max(1000).nullable().parse(folder);
  await chatAgent(session.founder.id, id);
  try { return await browseAgentFolders(current); }
  catch { throw new Error("폴더를 탐색할 수 없습니다. 접근 가능한 서버 PC 폴더를 선택해 주세요."); }
}
