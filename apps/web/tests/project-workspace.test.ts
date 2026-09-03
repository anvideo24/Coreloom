import { describe, expect, it } from "vitest";

import { buildProjectWorkspace } from "@/lib/domain/project-workspace";

describe("project workspace", () => {
  it("keeps the latest quote, contract, and document versions", () => {
    const workspace = buildProjectWorkspace({
      project: { id: "p1", name: "브랜드 사이트", clientName: "고객A", status: "active", statusLabel: "진행 중", progressPercent: 40 },
      contacts: [{ id: "c1", name: "김담당", role: "PM", detail: "pm@example.com" }],
      tasks: [],
      quotes: [
        { quoteId: "q1", versionNumber: 2, title: "유지보수 v2", totalAmount: 4000 },
        { quoteId: "q1", versionNumber: 1, title: "유지보수 v1", totalAmount: 3000 },
      ],
      contracts: [
        { contractId: "ct1", versionNumber: 2, title: "계약 v2", statusLabel: "체결", totalAmount: 4000 },
        { contractId: "ct1", versionNumber: 1, title: "계약 v1", statusLabel: "초안", totalAmount: 3000 },
      ],
      billings: [],
      documents: [
        { documentId: "d1", versionNumber: 2, title: "산출물", kindLabel: "산출물" },
        { documentId: "d1", versionNumber: 1, title: "산출물", kindLabel: "산출물" },
      ],
      evidence: [],
      proposals: [],
    });
    expect(workspace.quotes).toEqual([{ href: "/quotes/q1", title: "유지보수 v2", detail: "v2", amount: 4000 }]);
    expect(workspace.contracts[0]).toMatchObject({ href: "/contracts/ct1", detail: "v2 · 체결" });
    expect(workspace.documents).toHaveLength(1);
    expect(workspace.documents[0].detail).toBe("산출물 · v2");
  });

  it("puts evidence in time order and attaches AI proposals with official-decision labels", () => {
    const workspace = buildProjectWorkspace({
      project: { id: "p1", name: "브랜드 사이트", clientName: "고객A", status: "active", statusLabel: "진행 중", progressPercent: 40 },
      contacts: [],
      tasks: [
        { id: "t2", title: "다음 주", dueDate: "2026-09-10", statusLabel: "진행", status: "open" },
        { id: "t1", title: "오늘", dueDate: "2026-09-03", statusLabel: "진행", status: "open", agentName: "초안 도우미" },
      ],
      quotes: [],
      contracts: [],
      billings: [
        { id: "b2", kindLabel: "잔금", amount: 1000, dueDate: "2026-10-01", statusLabel: "예정" },
        { id: "b1", kindLabel: "착수금", amount: 500, dueDate: "2026-09-05", statusLabel: "입금 확인" },
      ],
      documents: [],
      evidence: [
        { id: "e1", title: "첫 메일", kindLabel: "메일", occurredOn: "2026-09-01", occurredTime: "10:00", originalUrl: "https://example.com/mail", linkReason: "범위 확인" },
        { id: "e2", title: "나중 회의", kindLabel: "회의", occurredOn: "2026-09-03", occurredTime: "14:00", originalUrl: null, linkReason: "일정 조율" },
      ],
      proposals: [
        { id: "pr1", evidenceId: "e2", kindLabel: "다음 할 일", body: "일정 확정", status: "proposed", statusLabel: "제안 (미확정)" },
        { id: "pr2", evidenceId: "e1", kindLabel: "현재 합의", body: "범위 합의", status: "confirmed", statusLabel: "확정" },
      ],
    });
    expect(workspace.tasks.map((item) => item.title)).toEqual(["오늘", "다음 주"]);
    expect(workspace.tasks[0].detail).toBe("기한 2026-09-03 · 진행 · 초안 도우미");
    expect(workspace.billings.map((item) => item.href)).toEqual(["/billings/b1", "/billings/b2"]);
    expect(workspace.timeline.map((group) => group.occurredOn)).toEqual(["2026-09-03", "2026-09-01"]);
    expect(workspace.timeline[0].records[0].proposals[0]).toMatchObject({
      href: "/proposals/pr1",
      detail: "다음 할 일 · 공식 결정 아님",
    });
    expect(workspace.timeline[1].records[0]).toMatchObject({
      originalUrl: "https://example.com/mail",
      proposals: [{ href: "/proposals/pr2", detail: "현재 합의 · 공식 결정" }],
    });
  });
});
