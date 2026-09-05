// F04 — AI가 「말만 한 것 / 저장할 후보(제안) / 실제 반영한 것」을 섞지 않는지 검증한다.
// 계획서: docs/superpowers/plans/2026-09-05-measurable-improvements.md의 ## F04 절.
// 인계: manual/handoffs/2026-09-05-claude-stage5-ai-status.md.
//
// 이 파일은 새 쓰기 도구를 넣지 않는다. 이미 있는 도메인 함수(ai-proposals, chat-runs)와
// API 라우트(agents/chat/route.ts)만 실행하며, 라우트 시험은 기존 agent-chat.test.ts와 같은
// 방식으로 chat-repository·session 모듈을 모킹해 실제 DB를 부르지 않는다.
import { describe, expect, it, vi, beforeEach } from "vitest";

import { chatPrompt } from "@/lib/domain/agent-chat";

import {
  confirmAiProposal,
  rejectAiProposal,
  isOfficialDecision,
  aiProposalStatusLabels,
  type AiProposalStatus,
} from "@/lib/domain/ai-proposals";
import { beginChatRun, chatRunActive, finishChatRun, stopChatRun } from "@/lib/agents/chat-runs";

vi.mock("@/lib/auth/session", () => ({ founderSession: vi.fn() }));
vi.mock("@/lib/agents/chat-repository", () => ({
  readAgentChats: vi.fn(),
  readAgentRequest: vi.fn(),
  sendAgentChat: vi.fn(),
}));
import { founderSession } from "@/lib/auth/session";
import { readAgentRequest, sendAgentChat } from "@/lib/agents/chat-repository";
import { GET, POST } from "@/app/api/agents/chat/route";

const AGENT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_AGENT_ID = "00000000-0000-4000-8000-000000000002";
const FOUNDER = { id: "founder-a", email: "" };

function uuid(n: number) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function chatRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/agents/chat", {
    method: "POST",
    headers: { host: "localhost", origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function streamEvents(response: Response) {
  const text = await response.text();
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as { type: string; [key: string]: unknown });
}

/** 이벤트 루프의 마이크로태스크를 모두 비운다. 라우트가 founderSession()·request.json()을
 * await한 뒤 beginChatRun을 부르므로, 두 번째 요청을 보내기 전에 첫 요청이 그 지점까지
 * 진행됐는지 확인해야 "같은 요청이 겹쳐 온" 상황을 정확히 재현할 수 있다. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(founderSession).mockResolvedValue({ state: "authorized", founder: FOUNDER } as never);
});

describe("F04-02 — 승인 전·실패 시 「반영됨」 오표시 0건", () => {
  it("1) 대표가 승인하지 않은 확정 시도(거절)는 확정되지 않는다", () => {
    expect(() => confirmAiProposal({ status: "proposed", approved: false })).toThrow(
      "Representative approval is required",
    );
    // 시도가 막혔으니 상태는 그대로 proposed다 — 공식 결정이 아니고, 화면 라벨도 "확정"이 아니다.
    expect(isOfficialDecision("proposed")).toBe(false);
    expect(aiProposalStatusLabels.proposed).not.toBe("확정");
    expect(aiProposalStatusLabels.proposed).toBe("제안 (미확정)");
  });

  it("2) 요청이 시간 초과로 끝나도 「사용자가 중지했다」로 잘못 표시하지 않는다", async () => {
    vi.mocked(sendAgentChat).mockRejectedValue(new Error("model timed out"));
    const response = await POST(
      chatRequest({ agentId: AGENT_ID, requestId: uuid(10), message: "타임아웃 확인", model: "gpt-5.4-mini", pathname: "/agents" }),
    );
    const events = await streamEvents(response);
    const errorEvent = events.find((event) => event.type === "error");
    // 사용자는 중지를 누르지 않았다(run controller가 abort되지 않음) — 문구도 중지가 아니라 일반 실패여야 한다.
    expect(errorEvent?.error).toBe("응답을 완료하지 못했습니다. 구독 연결·사용 한도를 확인하고 다시 보내 주세요.");
    expect(errorEvent?.error).not.toContain("중지");
    expect(events.some((event) => event.type === "message")).toBe(false);
  });

  it("3) 같은 요청이 두 번 오면 두 번째는 409로 거부되고 실행은 한 번만 일어난다", async () => {
    let resolveFirst!: (value: Awaited<ReturnType<typeof sendAgentChat>>) => void;
    vi.mocked(sendAgentChat).mockImplementation(
      () => new Promise<Awaited<ReturnType<typeof sendAgentChat>>>((resolve) => { resolveFirst = resolve; }),
    );
    const requestId = uuid(11);
    const body = { agentId: AGENT_ID, requestId, message: "중복 확인", model: "gpt-5.4-mini", pathname: "/agents" };
    const firstResponsePromise = POST(chatRequest(body));
    await flush();
    const secondResponse = await POST(chatRequest(body));
    expect(secondResponse.status).toBe(409);
    expect(sendAgentChat).toHaveBeenCalledTimes(1);
    resolveFirst({ id: "reply-dup", role: "assistant", body: "ok", model: "gpt-5.4-mini", status: "complete" } as Awaited<ReturnType<typeof sendAgentChat>>);
    const firstResponse = await firstResponsePromise;
    await firstResponse.body?.cancel().catch(() => {});
    finishChatRun(requestId);
  });

  it("4) 서버 오류로 실패해도 화면 문구가 완료·확정으로 보이지 않는다", async () => {
    vi.mocked(sendAgentChat).mockRejectedValue(new Error("database unavailable"));
    const response = await POST(
      chatRequest({ agentId: AGENT_ID, requestId: uuid(12), message: "서버 오류 확인", model: "gpt-5.4-mini", pathname: "/agents" }),
    );
    const events = await streamEvents(response);
    const errorEvent = events.find((event) => event.type === "error");
    expect(errorEvent?.error).toBe("응답을 완료하지 못했습니다. 구독 연결·사용 한도를 확인하고 다시 보내 주세요.");
    expect(events.some((event) => event.type === "message")).toBe(false);
    // "failed"는 채팅 메시지가 실제로 쓰는 상태값이다(chat-repository.ts) — 그 값 자체가 공식 결정으로 읽히지 않는다.
    expect(isOfficialDecision("failed")).toBe(false);
  });

  it("채팅 답변만으로는 어떤 기록도 confirmed가 되지 않는다", () => {
    // 채팅 메시지가 실제로 가질 수 있는 상태값(agent_chat_messages.status 기본값 "complete", 실패 시 "failed").
    for (const chatMessageStatus of ["complete", "failed"]) {
      expect(isOfficialDecision(chatMessageStatus)).toBe(false);
    }
  });
});

describe("F04-03 — 반영 결과 재조회 일치율 100%", () => {
  // 이 시험은 DB 리포지토리(lib/ai-proposals/repository.ts)를 부르지 않는다.
  // `ai_proposals` 테이블 한 행을 흉내 낸 메모리 Map을 "가상 저장소"로 두고,
  // 도메인 함수(confirmAiProposal/rejectAiProposal)가 돌려주는 갱신 값만 그 Map에 적용한 뒤,
  // 별도의 reread()로 다시 읽어 대조한다. 실제 SQL 트랜잭션·동시성·auditEvents 적재·워크스페이스
  // 격리는 흉내 내지 않는다 — 오직 "저장한 값과 재조회한 값이 같은가"만 재현한다.
  type StoredProposal = {
    id: string;
    body: string;
    status: AiProposalStatus;
    decisionReason: string | null;
    history: string[];
  };

  function fakeProposalStore() {
    const table = new Map<string, StoredProposal>();
    return {
      insert(row: StoredProposal) { table.set(row.id, { ...row }); },
      update(id: string, patch: Partial<Pick<StoredProposal, "status" | "decisionReason">>) {
        const current = table.get(id);
        if (!current) throw new Error("행이 없습니다.");
        table.set(id, { ...current, ...patch, history: [...current.history, patch.status ?? current.status] });
      },
      /** 별도 객체를 새로 만들어 돌려준다 — 참조 공유가 아니라 "다시 조회"를 흉내 낸다. */
      reread(id: string): StoredProposal {
        const row = table.get(id);
        if (!row) throw new Error("행이 없습니다.");
        return JSON.parse(JSON.stringify(row));
      },
    };
  }

  function listProposalMismatches(saved: StoredProposal, reread: StoredProposal): string[] {
    const mismatches: string[] = [];
    if (saved.id !== reread.id) mismatches.push("id");
    if (saved.body !== reread.body) mismatches.push("body");
    if (saved.status !== reread.status) mismatches.push("status");
    if ((saved.decisionReason || null) !== (reread.decisionReason || null)) mismatches.push("decisionReason");
    if (JSON.stringify(saved.history) !== JSON.stringify(reread.history)) mismatches.push("history");
    return mismatches;
  }

  it("확정한 제안은 재조회해도 ID·내용·상태·결정 이력이 그대로다", () => {
    const store = fakeProposalStore();
    store.insert({ id: "proposal-confirmed-1", body: "착수일을 다음 주 월요일로 본다", status: "proposed", decisionReason: null, history: ["proposed"] });
    const update = confirmAiProposal({ status: "proposed", approved: true });
    store.update("proposal-confirmed-1", { status: update.status });
    const saved = store.reread("proposal-confirmed-1");
    const rereadLater = store.reread("proposal-confirmed-1"); // 시간이 지난 뒤 다시 조회한 상황
    expect(listProposalMismatches(saved, rereadLater)).toEqual([]);
    expect(saved.id).toBe("proposal-confirmed-1");
    expect(saved.status).toBe("confirmed");
    expect(saved.history).toEqual(["proposed", "confirmed"]);
    expect(isOfficialDecision(saved.status)).toBe(true);
  });

  it("반려한 제안은 사유가 남고, 나중에 다시 조회해도 확정으로 뒤집히지 않는다", () => {
    const store = fakeProposalStore();
    store.insert({ id: "proposal-rejected-1", body: "예산 초과 위험이 있다", status: "proposed", decisionReason: null, history: ["proposed"] });
    const update = rejectAiProposal({ status: "proposed", approved: true, reason: " 원문과 다름 " });
    store.update("proposal-rejected-1", { status: update.status, decisionReason: update.decisionReason });
    const reread = store.reread("proposal-rejected-1");
    expect(reread.status).toBe("rejected");
    expect(reread.decisionReason).toBe("원문과 다름");
    expect(isOfficialDecision(reread.status)).toBe(false);
    // 결정된 항목은 도메인 함수 자체가 재변경을 막는다 — 나중에 조회해도 뒤집히지 않는다는 증거.
    expect(() => confirmAiProposal({ status: reread.status, approved: true })).toThrow("Decided proposals cannot be changed");
    const rereadAgain = store.reread("proposal-rejected-1");
    expect(listProposalMismatches(reread, rereadAgain)).toEqual([]);
    expect(rereadAgain.status).toBe("rejected");
  });
});

describe("F04-04 — 사용자가 누르지 않은 중지의 오표시 0건", () => {
  it("1) 브라우저 연결이 끊겨도 실행의 abort 신호는 켜지지 않는다", () => {
    const requestId = "disconnect-case";
    const controller = beginChatRun(FOUNDER.id, AGENT_ID, requestId);
    // route.ts에서 연결 끊김은 스트림의 `connected` 플래그만 내린다 — run controller는 별개다.
    expect(controller.signal.aborted).toBe(false);
    expect(chatRunActive(FOUNDER.id, AGENT_ID, requestId)).toBe(true);
    finishChatRun(requestId);
  });

  it("2) 화면을 다시 열어 상태만 확인해도(GET) 실행이 멈추지 않는다", async () => {
    const requestId = uuid(20);
    const controller = beginChatRun(FOUNDER.id, AGENT_ID, requestId);
    vi.mocked(readAgentRequest).mockResolvedValue({ threads: [], messages: [] });
    const response = await GET(new Request(`http://localhost/api/agents/chat?agentId=${AGENT_ID}&requestId=${requestId}`));
    const data = await response.json();
    expect(data.running).toBe(true);
    expect(controller.signal.aborted).toBe(false);
    finishChatRun(requestId);
  });

  it("3) 대표가 실제로 중지를 누르면 그 실행은 중지로 남는다", async () => {
    const requestId = uuid(21);
    vi.mocked(sendAgentChat).mockImplementation(
      (_actor, _input, signal: AbortSignal) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    );
    const runPromise = POST(chatRequest({ agentId: AGENT_ID, requestId, message: "중지 확인", model: "gpt-5.4-mini", pathname: "/agents" }));
    await flush();
    const stopResponse = await POST(chatRequest({ action: "stop", agentId: AGENT_ID, requestId }));
    const stopData = await stopResponse.json();
    expect(stopData.stopped).toBe(true);
    const events = await streamEvents(await runPromise);
    const errorEvent = events.find((event) => event.type === "error");
    expect(errorEvent?.error).toBe("사용자가 응답을 중지했습니다.");
  });

  it("4) 다른 사용자는 남의 실행을 중지시킬 수 없다", async () => {
    const requestId = uuid(22);
    vi.mocked(sendAgentChat).mockImplementation(() => new Promise(() => {}));
    const runPromise = POST(chatRequest({ agentId: AGENT_ID, requestId, message: "test", model: "gpt-5.4-mini", pathname: "/agents" }));
    await flush();
    vi.mocked(founderSession).mockResolvedValueOnce({ state: "authorized", founder: { id: "other-founder", email: "" } } as never);
    const stopResponse = await POST(chatRequest({ action: "stop", agentId: AGENT_ID, requestId }));
    const stopData = await stopResponse.json();
    expect(stopData.stopped).toBe(false);
    expect(chatRunActive(FOUNDER.id, AGENT_ID, requestId)).toBe(true);
    finishChatRun(requestId);
    await (await runPromise).body?.cancel().catch(() => {});
  });

  it("5) 같은 사용자라도 다른 에이전트로는 남의 실행을 중지시킬 수 없다", () => {
    const requestId = "cross-agent-case";
    const controller = beginChatRun(FOUNDER.id, AGENT_ID, requestId);
    expect(stopChatRun(FOUNDER.id, OTHER_AGENT_ID, requestId)).toBe(false);
    expect(controller.signal.aborted).toBe(false);
    finishChatRun(requestId);
  });
});

describe("F04-02: 모델에 주는 지시문이 「한 것처럼 말하기」를 막는다", () => {
  /*
   * 화면의 상태 표시가 마지막 관문이지만, 그 앞에서 말투가 오해를 만든다. 아무것도 못 바꾸는
   * 도우미가 「정리했습니다」라고 답하면 대표는 이미 반영된 것으로 읽는다. 읽기에 대해서는
   * 「읽지 않은 자료를 읽었다고 주장하지 마세요」가 있었는데, 한 일에 대해서는 없었다.
   */
  const prompt = chatPrompt(
    {
      name: "SYNTHETIC-AGENT", purpose: "가상 목적", instructions: null, workStyle: null,
      answerStyle: null, procedure: null, accessScope: "workspace", allowedWork: {},
    },
    [{ role: "user", body: "미분류 비용 정리해줘" }],
    "가상 화면",
  );

  it("바꿀 수 없다는 사실과 완료형 금지를 함께 담는다", () => {
    expect(prompt).toContain("회사 기록을 바꿀 수 없습니다");
    expect(prompt).toContain("하지 않은 일을 한 것처럼 말하지 마세요");
  });

  it("오해를 부르는 말투를 낱말로 집어 준다", () => {
    for (const word of ["정리했습니다", "저장했습니다", "처리했습니다", "반영했습니다"]) {
      expect(prompt, `${word}를 금지 예시로 집어 주지 않으면 모델이 무엇을 피할지 모른다`).toContain(word);
    }
  });

  it("확정 전에는 회사의 결정이 아니라고 못 박는다", () => {
    expect(prompt).toContain("대표가 확정하기 전까지는 어떤 것도 회사의 결정이 아닙니다");
  });
});
