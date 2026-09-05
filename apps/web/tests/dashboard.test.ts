import { describe, expect, it } from "vitest";

import { buildFounderDashboard, calendarDateInTimeZone, monthWeekBuckets } from "@/lib/domain/dashboard";

const empty = {
  quotes: [],
  contracts: [],
  billings: [],
  pendingProposals: [],
  projects: [],
  revenue: { confirmedAmount: 0, scheduledAmount: 0, unclassifiedCount: 0 },
  expenses: [],
  tasks: [],
  recentDecisions: [],
  documentCount: 0,
};

describe("founder dashboard date", () => {
  it("uses the Seoul calendar date", () => {
    expect(calendarDateInTimeZone(new Date("2026-09-03T15:30:00.000Z"))).toBe("2026-09-04");
    expect(calendarDateInTimeZone(new Date("2026-09-03T14:59:00.000Z"))).toBe("2026-09-03");
  });
});

describe("founder dashboard summary", () => {
  it("puts company setup progress and missing evidence first", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-03",
      setupItems: [
        { id: "1", title: "사업자등록 신청 준비", status: "in_progress", evidenceReference: null },
        { id: "2", title: "사업자등록증 보관", status: "complete", evidenceReference: "회사 문서함/등록증" },
        { id: "3", title: "공동사업 여부 확인", status: "not_applicable", evidenceReference: null },
      ],
    });
    expect(dashboard.setupProgress).toBe(67);
    expect(dashboard.openSetupItems).toEqual([
      { href: "/company-setup", title: "사업자등록 신청 준비", detail: "진행 중" },
    ]);
    expect(dashboard.evidenceGaps).toEqual([
      { href: "/company-setup", title: "사업자등록 신청 준비", detail: "증빙 위치 없음" },
    ]);
  });

  it("lists unsent quotes, unexecuted contracts, due billings, and pending proposals", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-03",
      setupItems: [],
      quotes: [
        { quoteId: "q1", versionId: "v2", versionNumber: 2, title: "유지보수", clientName: "고객A", projectId: "pr1", totalAmount: 3000, emailRequested: false },
        { quoteId: "q2", versionId: "v1", versionNumber: 1, title: "이미 보낸 견적", clientName: "고객B", projectId: null, totalAmount: 1000, emailRequested: true },
      ],
      contracts: [
        { contractId: "c1", title: "날인 대기", clientName: "고객A", projectId: "pr1", status: "original_recorded", totalAmount: 3000 },
        { contractId: "c2", title: "체결됨", clientName: "고객B", projectId: null, status: "executed", totalAmount: 1000 },
      ],
      billings: [
        { id: "b1", clientName: "고객A", contractTitle: "유지보수", kindLabel: "반복 청구", amount: 3000, billingDate: "2026-09-01", dueDate: "2026-09-03", projectId: null,
          status: "scheduled" },
        { id: "b2", clientName: "고객A", contractTitle: "유지보수", kindLabel: "잔금", amount: 1000, billingDate: "2026-10-01", dueDate: "2026-10-10", projectId: null, status: "scheduled" },
        { id: "b3", clientName: "고객B", contractTitle: "입금됨", kindLabel: "착수금", amount: 500, billingDate: "2026-08-01", dueDate: "2026-08-05", projectId: null, status: "deposited" },
      ],
      pendingProposals: [
        { id: "p1", kindLabel: "다음 할 일", body: "일정 조율이 필요합니다", clientName: "고객A", projectName: "브랜드 사이트" },
      ],
    });
    expect(dashboard.quotesToSend.map((item) => item.href)).toEqual(["/quotes/q1/versions/v2/email"]);
    expect(dashboard.contractsToExecute.map((item) => item.href)).toEqual(["/contracts/c1"]);
    expect(dashboard.billingsToCheck.map((item) => item.href)).toEqual(["/billings/b1"]);
    expect(dashboard.proposalsToReview[0]).toMatchObject({
      href: "/proposals/p1",
      detail: "고객A · 브랜드 사이트 · 다음 할 일 · 공식 결정 아님",
    });
  });

  it("keeps overdue tasks before later dates and hides completed projects", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-03",
      setupItems: [],
      projects: [
        { id: "pr1", name: "진행 프로젝트", clientName: "고객A", status: "active", progressPercent: 40 },
        { id: "pr2", name: "끝난 프로젝트", clientName: "고객B", status: "complete", progressPercent: 100 },
      ],
      tasks: [
        { id: "t2", title: "다음 주 업무", dueDate: "2026-09-10", status: "open", clientName: "고객A", projectName: "사이트" },
        { id: "t1", title: "지난 업무", dueDate: "2026-09-01", status: "open", clientName: "고객A", projectName: "사이트" },
        { id: "t3", title: "완료된 업무", dueDate: "2026-09-02", status: "done", clientName: "고객A", projectName: "사이트" },
      ],
      recentDecisions: [
        { id: "d1", kindLabel: "위험", body: "일정 지연", statusLabel: "확정", clientName: "고객A", projectName: "사이트" },
      ],
      documentCount: 4,
      revenue: { confirmedAmount: 3000, scheduledAmount: 1000, unclassifiedCount: 1 },
      expenses: [
        { id: "ex1", title: "광고비", counterparty: "미분류", amount: 4000, settlementDate: "2026-09-03", status: "scheduled", unclassified: true },
        { id: "ex2", title: "호스팅", counterparty: "구독 서비스", amount: 1000, settlementDate: "2026-09-10", status: "scheduled", unclassified: false },
        { id: "ex3", title: "이미 지급", counterparty: "구독 서비스", amount: 2000, settlementDate: "2026-09-01", status: "confirmed", unclassified: false },
      ],
    });
    expect(dashboard.activeProjects.map((item) => item.href)).toEqual(["/clients-projects/pr1"]);
    expect(dashboard.expensesToCheck.map((item) => item.href)).toEqual(["/expenses/ex1"]);
    expect(dashboard.expenses).toEqual({ confirmedAmount: 2000, scheduledAmount: 5000, unclassifiedCount: 1 });
    expect(dashboard.schedule.map((item) => item.title)).toEqual(["지난 업무", "다음 주 업무"]);
    expect(dashboard.schedule[0].detail).toContain("지남");
    expect(dashboard.recentDecisions[0].href).toBe("/proposals/d1");
    expect(dashboard.documentCount).toBe(4);
    expect(dashboard.revenue.unclassifiedCount).toBe(1);
  });

  it("builds one inbox, vitals, cash weeks, and project cards", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-03",
      setupItems: [
        { id: "1", title: "사업자등록 신청 준비", status: "in_progress", evidenceReference: null },
      ],
      quotes: [
        { quoteId: "q1", versionId: "v2", versionNumber: 2, title: "유지보수", clientName: "고객A", projectId: "pr1", totalAmount: 3000, emailRequested: false },
      ],
      contracts: [
        { contractId: "c1", title: "날인 대기", clientName: "고객A", projectId: "pr1", status: "original_recorded", totalAmount: 3000 },
      ],
      billings: [
        { id: "b1", clientName: "고객A", contractTitle: "유지보수", kindLabel: "반복 청구", amount: 3000, billingDate: "2026-09-01", dueDate: "2026-09-02", projectId: "pr1", status: "scheduled" },
      ],
      pendingProposals: [
        { id: "p1", kindLabel: "다음 할 일", body: "일정 조율이 필요합니다", clientName: "고객A", projectName: "브랜드 사이트" },
      ],
      projects: [
        { id: "pr1", name: "진행 프로젝트", clientName: "고객A", status: "active", progressPercent: 40 },
      ],
      tasks: [
        { id: "t1", title: "지난 업무", dueDate: "2026-09-01", status: "open", clientName: "고객A", projectName: "사이트" },
        { id: "t2", title: "오늘 업무", dueDate: "2026-09-03", status: "open", clientName: "고객A", projectName: "사이트" },
      ],
      revenue: { confirmedAmount: 3000, scheduledAmount: 1000, unclassifiedCount: 1 },
      expenses: [
        { id: "ex1", title: "광고비", counterparty: "미분류", amount: 4000, settlementDate: "2026-09-03", status: "scheduled", unclassified: true },
      ],
    });
    expect(dashboard.inbox[0]).toMatchObject({ kind: "deposit", overdue: true, title: "유지보수" });
    expect(dashboard.inbox.map((item) => item.kind)).toContain("task");
    expect(dashboard.vitals).toEqual({
      pendingApprovals: 2,
      todayTasks: 1,
      overdueDeposits: 1,
      unclassified: 2,
      cashRhythm: "watch",
    });
    expect(dashboard.cashWeeks[0]).toEqual({ label: "1주", inflow: 3000, outflow: 4000 });
    expect(dashboard.projectCards[0]).toMatchObject({
      title: "진행 프로젝트",
      stages: { quote: true, contract: false, billing: true },
      nextAction: "입금 · 유지보수",
    });
    expect(dashboard.weekDays.map((day) => day.label)).toEqual(["월", "화", "수", "목", "금", "토", "일"]);
    expect(dashboard.weekDays.find((day) => day.isToday)?.date).toBe("2026-09-03");
    expect(dashboard.weekDays.find((day) => day.date === "2026-09-01")?.count).toBe(1);
  });

  it("gives unique inbox ids when several setup items share the company-setup href", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-03",
      setupItems: [
        { id: "1", title: "사업자등록 신청 준비", status: "in_progress", evidenceReference: null },
        { id: "2", title: "사업자등록증 보관", status: "not_started", evidenceReference: null },
        { id: "3", title: "공동사업 여부 확인", status: "in_progress", evidenceReference: null },
      ],
    });
    const setupInbox = dashboard.inbox.filter((item) => item.href === "/company-setup");
    expect(setupInbox.length).toBeGreaterThan(1);
    expect(new Set(setupInbox.map((item) => item.id)).size).toBe(setupInbox.length);
  });
});


describe("founder dashboard accuracy (F05)", () => {
  it("includes month-end billings in monthly scheduled inflow (F05-01)", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      billings: [
        {
          id: "b-month-end",
          clientName: "SYNTHETIC",
          contractTitle: "TEST",
          kindLabel: "잔금",
          amount: 100,
          billingDate: "2026-09-29",
          dueDate: "2026-09-30",
          projectId: null,
          status: "scheduled",
        },
      ],
    });
    const monthInflow = dashboard.cashWeeks.reduce((sum, week) => sum + week.inflow, 0);
    expect(monthWeekBuckets("2026-09-05").at(-1)?.end).toBe("2026-09-30");
    expect(monthInflow).toBe(100);
  });

  it("counts inflow by due date, not billing date (F05-02)", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      billings: [
        {
          id: "b-cross-month",
          clientName: "SYNTHETIC",
          contractTitle: "TEST",
          kindLabel: "잔금",
          amount: 100,
          billingDate: "2026-09-02",
          dueDate: "2026-10-02",
          projectId: null,
          status: "scheduled",
        },
      ],
    });
    const septemberInflow = dashboard.cashWeeks.reduce((sum, week) => sum + week.inflow, 0);
    expect(septemberInflow).toBe(0);
  });

  it("keeps quote stage scoped to the project, not the client (F05-03)", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      projects: [
        { id: "p1", name: "TEST-P1", clientName: "SYNTHETIC", status: "active", progressPercent: 0 },
        { id: "p2", name: "TEST-P2", clientName: "SYNTHETIC", status: "active", progressPercent: 0 },
      ],
      quotes: [
        {
          quoteId: "q1",
          versionId: "v1",
          versionNumber: 1,
          title: "TEST-Q1",
          clientName: "SYNTHETIC",
          projectId: "p1",
          totalAmount: 100,
          emailRequested: false,
        },
      ],
    });
    expect(dashboard.projectCards.map((card) => card.stages.quote)).toEqual([true, false]);
  });
});
