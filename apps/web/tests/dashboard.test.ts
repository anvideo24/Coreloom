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
  // F05-01 fixture set: 28/29/30/31일 말일 + 윤년 + 연도 전환 경계를 각각 고정 날짜로 잰다.
  const monthEndCases = [
    { label: "평년 2월 28일 말일(2026-02)", today: "2026-02-05", dueDate: "2026-02-28", expectedEnd: "2026-02-28" },
    { label: "윤년 2월 29일 말일(2028-02)", today: "2028-02-05", dueDate: "2028-02-29", expectedEnd: "2028-02-29" },
    { label: "30일 말일(2026-09)", today: "2026-09-05", dueDate: "2026-09-30", expectedEnd: "2026-09-30" },
    { label: "31일 말일(2026-12)", today: "2026-12-05", dueDate: "2026-12-31", expectedEnd: "2026-12-31" },
  ];

  it.each(monthEndCases)("includes $label in monthly scheduled inflow with no leftover (F05-01)", ({ today, dueDate, expectedEnd }) => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today,
      setupItems: [],
      billings: [
        {
          id: "b-month-end",
          clientName: "SYNTHETIC",
          contractTitle: "TEST",
          kindLabel: "잔금",
          amount: 100,
          billingDate: dueDate,
          dueDate,
          projectId: null,
          status: "scheduled",
        },
      ],
    });
    expect(monthWeekBuckets(today).at(-1)?.end, `${today} 기준 월말 버킷 끝 날짜`).toBe(expectedEnd);
    const monthInflow = dashboard.cashWeeks.reduce((sum, week) => sum + week.inflow, 0);
    expect(monthInflow, `${today} / dueDate=${dueDate} 월간 입금 합계`).toBe(100);
  });

  it("keeps a Dec 31 due item in December only and a Jan 1 due item in January only (F05-01 year boundary)", () => {
    const billings = [
      { id: "b-dec-31", clientName: "SYNTHETIC", contractTitle: "TEST", kindLabel: "잔금", amount: 100, billingDate: "2026-12-20", dueDate: "2026-12-31", projectId: null, status: "scheduled" as const },
      { id: "b-jan-1", clientName: "SYNTHETIC", contractTitle: "TEST", kindLabel: "잔금", amount: 200, billingDate: "2026-12-20", dueDate: "2027-01-01", projectId: null, status: "scheduled" as const },
    ];
    const december = buildFounderDashboard({ ...empty, today: "2026-12-15", setupItems: [], billings });
    const january = buildFounderDashboard({ ...empty, today: "2027-01-15", setupItems: [], billings });
    const decemberInflow = december.cashWeeks.reduce((sum, week) => sum + week.inflow, 0);
    const januaryInflow = january.cashWeeks.reduce((sum, week) => sum + week.inflow, 0);
    expect(decemberInflow, "12월 집계에는 12/31 건(100)만 잡혀야 하고 1/1 건(200)이 섞이면 안 된다").toBe(100);
    expect(januaryInflow, "1월 집계에는 1/1 건(200)만 잡혀야 하고 12/31 건(100)이 남아 있으면 안 된다").toBe(200);
  });

  // F05-02: 이 시험이 쓰는 청구(billing) 상태 값의 뜻 — apps/web/src/lib/domain/billings.ts의
  // billingStatuses(["scheduled", "deposited"])가 정의한 값만 쓴다. 코드에 다른 상태는 없다.
  //   "scheduled" = 청구했고 아직 입금이 확인되지 않았다 → 이번 달 "입금 예정" 집계에 들어가야 한다.
  //   "deposited" = 입금이 실제로 확인됐다 → 더는 "예정"이 아니므로 이번 달 "입금 예정" 집계에서 빠져야 한다.
  it("counts inflow by due date, not billing date, for a scheduled billing (F05-02)", () => {
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

  const billingStatusCombos = [
    { label: "예정 상태 × 청구월=예정월", status: "scheduled" as const, billingDate: "2026-09-02", dueDate: "2026-09-05", expectedInflow: 100 },
    { label: "예정 상태 × 청구월≠예정월", status: "scheduled" as const, billingDate: "2026-09-02", dueDate: "2026-10-02", expectedInflow: 0 },
    { label: "확인 상태 × 청구월=예정월", status: "deposited" as const, billingDate: "2026-09-02", dueDate: "2026-09-05", expectedInflow: 0 },
    { label: "확인 상태 × 청구월≠예정월", status: "deposited" as const, billingDate: "2026-09-02", dueDate: "2026-10-05", expectedInflow: 0 },
  ];

  it.each(billingStatusCombos)("$label → 9월 입금 예정 집계는 $expectedInflow원이어야 한다 (F05-02)", ({ status, billingDate, dueDate, expectedInflow }) => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      billings: [
        { id: "b-combo", clientName: "SYNTHETIC", contractTitle: "TEST", kindLabel: "잔금", amount: 100, billingDate, dueDate, projectId: null, status },
      ],
    });
    const monthInflow = dashboard.cashWeeks.reduce((sum, week) => sum + week.inflow, 0);
    expect(monthInflow, `status=${status} billingDate=${billingDate} dueDate=${dueDate}`).toBe(expectedInflow);
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

  it("does not leak next-action or stage across two different companies that share the same display name (F05-03)", () => {
    // "동명 고객사" — clientName이 우연히 같은 서로 다른 실체(회사)를 가정한다. 화면엔
    // 이름만 보이므로 projectId로만 갈라야지, 이름 문자열로 매칭하면 다른 회사 것이 섞인다.
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      projects: [
        { id: "p1", name: "TEST-NAMESAKE-A", clientName: "SYNTHETIC", status: "active", progressPercent: 0 },
        { id: "p2", name: "TEST-NAMESAKE-B", clientName: "SYNTHETIC", status: "active", progressPercent: 0 },
      ],
      tasks: [
        { id: "t1", title: "TEST-TASK-FOR-P1", dueDate: "2026-09-01", status: "open", clientName: "SYNTHETIC", projectName: "TEST-NAMESAKE-A", projectId: "p1" },
      ],
      contracts: [
        { contractId: "c1", title: "TEST-CONTRACT", clientName: "SYNTHETIC", projectId: "p1", status: "executed", totalAmount: 500 },
      ],
    });
    const cardA = dashboard.projectCards.find((card) => card.href === "/clients-projects/p1");
    const cardB = dashboard.projectCards.find((card) => card.href === "/clients-projects/p2");
    expect(cardA?.nextAction, "p1의 다음 행동은 p1 소속 업무여야 한다").toBe("업무 · TEST-TASK-FOR-P1");
    expect(cardB?.nextAction, "p2는 자기 소속 항목이 없으니 p1의 업무가 새어 들어오면 안 된다").toBe("다음 할 일이 없습니다");
    expect(cardA?.stages.contract, "계약 체결은 p1에만 있다").toBe(true);
    expect(cardB?.stages.contract, "동명 회사라고 p2에 계약 완료가 번지면 안 된다").toBe(false);
  });

  it("leaves a project-less record out of every project card instead of guessing by client name (F05-03)", () => {
    /*
     * 스키마상 견적·계약·청구의 projectId는 비어 있을 수 있다. 예전에는 고객사 이름이 겹치면
     * 그 항목을 아무 프로젝트의 「다음 행동」으로 끌어다 붙였다. 이제는 붙이지 않는다.
     *
     * 이건 **의도한 동작 변화**다. 화면에서는 다음 행동이 사라진 것처럼 보이지만, 어느 프로젝트
     * 것인지 모르는 항목을 특정 프로젝트 것처럼 보여 주는 쪽이 더 나쁘다. 나중에 「다음 행동이
     * 안 뜬다」는 이유로 이름 매칭을 되살리면 이 시험이 막는다. 되살리려면 projectId를 채워라.
     */
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      projects: [
        { id: "p1", name: "TEST-ORPHAN-HOST", clientName: "SYNTHETIC", status: "active", progressPercent: 0 },
      ],
      quotes: [
        {
          quoteId: "q-orphan", versionId: "v1", versionNumber: 1, title: "TEST-UNLINKED-QUOTE",
          clientName: "SYNTHETIC", projectId: null, totalAmount: 100, emailRequested: false,
        },
      ],
    });
    const card = dashboard.projectCards.find((item) => item.href === "/clients-projects/p1");
    expect(card?.nextAction, "프로젝트에 안 붙은 견적을 이름만 보고 끌어오면 안 된다").toBe("다음 할 일이 없습니다");
    expect(card?.stages.quote, "프로젝트에 안 붙은 견적으로 견적 단계를 켜면 안 된다").toBe(false);
    // 그 항목 자체는 사라지지 않는다. 승인·처리 목록(inbox)에는 그대로 남는다.
    expect(dashboard.inbox.some((row) => row.title === "TEST-UNLINKED-QUOTE"), "항목 자체가 목록에서 사라지면 안 된다").toBe(true);
  });

  // F05-04: 기록 없음(empty)과 정상(normal)을 같은 표시로 섞지 않는다. 목표는 혼동 0건.
  it("marks cash rhythm as empty (not normal) when there is no billing or task record at all (F05-04)", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
    });
    expect(dashboard.vitals.cashRhythm, "데이터가 하나도 없으면 '정상'이 아니라 '기록 없음'이어야 한다").toBe("empty");
  });

  it("marks cash rhythm as normal when records exist and none are overdue (F05-04)", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      billings: [
        { id: "b1", clientName: "SYNTHETIC", contractTitle: "TEST", kindLabel: "잔금", amount: 100, billingDate: "2026-09-05", dueDate: "2026-09-20", projectId: null, status: "scheduled" },
      ],
      tasks: [
        { id: "t1", title: "TEST-TASK", dueDate: "2026-09-20", status: "open", clientName: "SYNTHETIC", projectName: "TEST-P", projectId: null },
      ],
    });
    expect(dashboard.vitals.cashRhythm, "기록이 있고 연체가 없으면 '정상'이어야 한다").toBe("normal");
  });

  it("marks cash rhythm as watch when a deposit or task is overdue, distinct from empty (F05-04)", () => {
    const overdueDeposit = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      billings: [
        { id: "b1", clientName: "SYNTHETIC", contractTitle: "TEST", kindLabel: "잔금", amount: 100, billingDate: "2026-08-01", dueDate: "2026-09-01", projectId: null, status: "scheduled" },
      ],
    });
    const overdueTask = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      tasks: [
        { id: "t1", title: "TEST-TASK", dueDate: "2026-09-01", status: "open", clientName: "SYNTHETIC", projectName: "TEST-P", projectId: null },
      ],
    });
    expect(overdueDeposit.vitals.cashRhythm, "연체 입금이 있으면 '주의'다").toBe("watch");
    expect(overdueTask.vitals.cashRhythm, "지연 업무가 있으면 '주의'다").toBe("watch");
  });
});
