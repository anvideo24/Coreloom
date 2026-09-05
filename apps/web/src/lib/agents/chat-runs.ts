// Development PC process registry. Browser disconnects must not cancel a model run.
// Survives hot module replacement; a PC process restart is not a durable job queue.
type Run = { actor: string; agentId: string; controller: AbortController };
const processState = globalThis as typeof globalThis & { coreloomChatRuns?: Map<string, Run> };
const runs = processState.coreloomChatRuns ||= new Map<string, Run>();
export function beginChatRun(actor: string, agentId: string, requestId: string) {
  if (runs.has(requestId)) throw new Error("이미 진행 중인 요청입니다.");
  const controller = new AbortController();
  runs.set(requestId, { actor, agentId, controller });
  return controller;
}
export function chatRunActive(actor: string, agentId: string, requestId: string) {
  const run = runs.get(requestId);
  return !!run && run.actor === actor && run.agentId === agentId;
}
export function stopChatRun(actor: string, agentId: string, requestId: string) {
  const run = runs.get(requestId);
  if (!run || run.actor !== actor || run.agentId !== agentId) return false;
  run.controller.abort("user-stop");
  return true;
}
export function finishChatRun(requestId: string) { runs.delete(requestId); }
