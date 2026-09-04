import { describe, expect, it } from "vitest";

import { buildApprovalInbox, summarizeApprovals } from "@/lib/domain/approvals";

describe("approval inbox", () => {
  it("collects pending money, contract, proposal, and agent items", () => {
    const items = buildApprovalInbox({
      expenses: [
        {
          id: "e1",
          title: "광고비",
          counterparty: "광고사",
          amount: 1000,
          settlementDate: "2026-09-10",
          status: "scheduled",
        },
        {
          id: "e2",
          title: "확정됨",
          counterparty: "광고사",
          amount: 500,
          settlementDate: "2026-09-01",
          status: "confirmed",
        },
      ],
      revenueEntries: [
        {
          id: "r1",
          href: "/revenue/r1",
          title: "구독",
          counterparty: "사업",
          amount: 2000,
          settlementDate: "2026-09-05",
          status: "scheduled",
          source: "revenue_entry",
        },
        {
          id: "b1",
          href: "/billings/b1",
          title: "청구",
          counterparty: "고객",
          amount: 3000,
          settlementDate: "2026-09-04",
          status: "scheduled",
          source: "billing",
        },
      ],
      billings: [
        {
          id: "b1",
          clientName: "고객A",
          contractTitle: "사이트",
          kindLabel: "착수금",
          amount: 3000,
          dueDate: "2026-09-04",
          status: "scheduled",
        },
      ],
      contracts: [
        {
          contractId: "c1",
          title: "계약서",
          clientName: "고객A",
          status: "original_recorded",
          totalAmount: 5000,
        },
        {
          contractId: "c2",
          title: "초안",
          clientName: "고객B",
          status: "draft",
          totalAmount: 1000,
        },
      ],
      proposals: [
        {
          id: "p1",
          kindLabel: "다음 할 일",
          body: "견적을 보낸다",
          clientName: "고객A",
          projectName: "사이트",
        },
      ],
      agentWorks: [
        {
          id: "w1",
          agentId: "a1",
          agentName: "조사 에이전트",
          requestNote: "자료 조사 요청",
          createdAt: "2026-09-03T12:00:00.000Z",
        },
      ],
    });

    expect(items.map((item) => item.kind)).toEqual([
      "agent_work",
      "billing",
      "revenue",
      "expense",
      "contract",
      "proposal",
    ]);
    expect(items.find((item) => item.kind === "revenue")?.href).toBe("/revenue/r1");
    expect(summarizeApprovals(items)).toEqual({
      total: 6,
      byKind: {
        expense: 1,
        revenue: 1,
        billing: 1,
        contract: 1,
        proposal: 1,
        agent_work: 1,
      },
    });
  });
});
