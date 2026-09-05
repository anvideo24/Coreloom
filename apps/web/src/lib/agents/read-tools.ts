import "server-only";
import { accessPolicy, assertToolAllowed, type ReadTool, type ReadResult } from "@/lib/domain/agent-access";
import { auditEvents } from "@/lib/db/schema";
import { chatAgent } from "./chat-repository";
import { erpReadQuery } from "./erp-read-query";
import { readAgentRoots } from "./access-store";
import { readAllowedFile, searchReadFiles } from "./read-files";

export async function executeReadTool(actor: string, agentId: string, threadId: string, tool: ReadTool): Promise<ReadResult> {
  // Re-read permissions on EVERY call, including between two model rounds.
  const { db, workspace, agent } = await chatAgent(actor, agentId);
  try {
    assertToolAllowed(accessPolicy(agent.capabilities), tool);
    let result: ReadResult;
    if (tool.tool === "erp") {
      const { query, route } = erpReadQuery(workspace.id, agent.projectId, agent.ventureId, tool);
      const response = await db.execute(query);
      const rows = response.rows.slice(0, 20);
      result = { rows, sources: rows.length ? rows.map((row) => route.endsWith("/") ? `${route}${row.id}` : route) : [route], found: rows.length, hasMore: response.rows.length > 20, offset: tool.offset, note: "현재 연결된 개발 DB 범위입니다. 목록 최대 20건, 상세는 id로 조회. 문서는 메타데이터·메모만 제공하며 원본 파일 내용은 포함하지 않습니다." };
    } else {
      const roots = await readAgentRoots(workspace.id, agent.id);
      if (!roots.length) throw new Error("허용 폴더가 없습니다.");
      result = tool.tool === "files.search" ? await searchReadFiles(roots, tool.query) : await readAllowedFile(roots, tool.root, tool.path);
    }
    // Provenance only: never log the returned contents or absolute PC paths.
    await db.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: actor, eventType: "ai_agent.read", payload: { agentId, threadId, tool: tool.tool, area: tool.tool === "erp" ? tool.area : "pc", sources: result.sources, status: "allowed" } });
    return result;
  } catch {
    await db.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: actor, eventType: "ai_agent.read", payload: { agentId, threadId, tool: tool.tool, status: "denied_or_failed" } });
    throw new Error("자료 조회가 허용되지 않았거나 실패했습니다.");
  }
}
