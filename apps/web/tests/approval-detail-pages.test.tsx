// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ state: "authorized" }));
const repositories = vi.hoisted(() => ({
  expense: vi.fn(), revenue: vi.fn(), billing: vi.fn(), contract: vi.fn(), proposal: vi.fn(), agent: vi.fn(),
}));
const actions = vi.hoisted(() => ({
  expenseConfirm: vi.fn(), revenueConfirm: vi.fn(), revenueRefund: vi.fn(), billingConfirm: vi.fn(),
  contractAmendment: vi.fn(), contractExecute: vi.fn(), contractOriginal: vi.fn(), contractTerms: vi.fn(),
  proposalConfirm: vi.fn(), proposalReject: vi.fn(),
  agentApprove: vi.fn(), agentDeactivate: vi.fn(), agentRecord: vi.fn(), agentReject: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ founderSession: vi.fn(async () => auth.state === "authorized" ? { state: "authorized", founder: { id: "founder" } } : { state: auth.state }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => { throw new Error(`redirect:${to}`); },
  notFound: () => { throw new Error("not-found"); },
}));
vi.mock("@/lib/expenses/repository", () => ({ getFounderExpenseEntryDetail: repositories.expense }));
vi.mock("@/lib/revenue/repository", () => ({ getFounderRevenueEntryDetail: repositories.revenue }));
vi.mock("@/lib/billings/repository", () => ({ getFounderBillingDetail: repositories.billing }));
vi.mock("@/lib/contracts/repository", () => ({ getFounderContractDetail: repositories.contract }));
vi.mock("@/lib/ai-proposals/repository", () => ({ getFounderAiProposalDetail: repositories.proposal }));
vi.mock("@/lib/agents/repository", () => ({ getFounderAgentDetail: repositories.agent }));
vi.mock("@/app/(private)/expenses/actions", () => ({ confirmExpenseEntryAction: actions.expenseConfirm }));
vi.mock("@/app/(private)/revenue/actions", () => ({ confirmRevenueEntryAction: actions.revenueConfirm, refundRevenueEntryAction: actions.revenueRefund }));
vi.mock("@/app/(private)/billings/actions", () => ({ confirmBillingDepositAction: actions.billingConfirm }));
vi.mock("@/app/(private)/contracts/actions", () => ({ executeContractAction: actions.contractExecute, createContractAmendmentAction: actions.contractAmendment, recordContractOriginalAction: actions.contractOriginal, updateContractTermsAction: actions.contractTerms }));
vi.mock("@/app/(private)/proposals/actions", () => ({ confirmAiProposalAction: actions.proposalConfirm, rejectAiProposalAction: actions.proposalReject }));
vi.mock("@/app/(private)/agents/actions", () => ({ approveAgentWorkAction: actions.agentApprove, deactivateAgentAction: actions.agentDeactivate, recordAgentWorkAction: actions.agentRecord, rejectAgentWorkAction: actions.agentReject }));
vi.mock("@/components/agent-chat", () => ({ AgentChat: () => <div>대화 자리</div> }));

const expense = (status = "scheduled") => ({ id: "expense-1", amount: 0, currency: "KRW", occurredOn: "2026-09-01", settlementDate: "2026-09-10", status, note: "영수증 #E-1", confirmedAt: null, ventureName: "앱", ventureKind: "app", clientName: null, projectName: null });
const revenue = (status = "scheduled") => ({ id: "revenue-1", amount: 0, currency: "KRW", occurredOn: "2026-09-01", settlementDate: "2026-09-10", status, note: "입금 참고 #R-1", confirmedAt: null, ventureName: "서비스", ventureKind: "subscription", clientName: null, projectName: null, refunds: [], refundedTotal: 0 });
const billing = (status = "scheduled") => ({ billing: { id: "billing-1", contractId: "contract-1", clientName: "고객", kind: "down_payment", amount: 0, currency: "KRW", billingDate: "2026-09-01", dueDate: "2026-09-10", status, note: "청구 참고", billingNumber: "B-1", poNumber: null, depositedAt: null, seriesId: null }, contractTitle: "운영 계약" });
const contract = (status = "original_recorded", originalReference: string | null = "문서함/날인본.pdf") => ({ contract: { id: "contract-1", quoteId: "quote-1", clientName: "고객" }, versions: [{ id: "version-1", versionNumber: 1, title: "운영 계약", status, originalReference, currency: "KRW", subtotalAmount: 0, totalAmount: 0, items: [], contractNumber: null, effectiveStartOn: null, effectiveEndOn: null, autoRenew: false, executedAt: null }] });
const proposal = (status = "proposed") => ({ id: "proposal-1", kind: "agreement", clientName: "고객", projectName: "프로젝트", body: "범위를 확정합니다", status, evidenceKind: "email", occurredOn: "2026-09-01", occurredTime: "10:00", evidenceTitle: "원문 제목", originalIdentifier: "source-1", originalUrl: null, decidedAt: null, decisionReason: null });
const agent = (pending = true) => ({ id: "agent-1", name: "지원 에이전트", status: "active", scopeLabel: "전체", purpose: "지원", allowedWork: ["research"], modelProvider: "gpt", capabilities: { save_records: false, send_external: false, confirm_money: false, change_permissions: false }, workStyle: null, answerStyle: null, procedure: null, instructions: null, openTasks: [], assignedTasks: [], work: { pending: pending ? [{ id: "work-1", status: "pending", requestNote: "검토 요청", inputNote: "입력 참고", resultNote: null, taskTitle: null }] : [], decided: pending ? [] : [{ id: "work-2", status: "approved", requestNote: "결정된 요청", inputNote: "입력", resultNote: "결과", taskTitle: null, decisionReason: null, decidedAt: new Date("2026-09-01") }] } });

const pages = [
  ["expense", "@/app/(private)/expenses/[entryId]/page", repositories.expense, expense, "entryId", "expense-1", "비용 확정", "앱 · 앱", "영수증 #E-1", "비용 확정 — 금액 고정, 자동 이체·세금계산서 없음"],
  ["revenue", "@/app/(private)/revenue/[entryId]/page", repositories.revenue, revenue, "entryId", "revenue-1", "매출 확정", "서비스 · 서비스", "입금 참고 #R-1", "매출 확정 — 금액 고정, 세금계산서 발행 없음"],
  ["billing", "@/app/(private)/billings/[billingId]/page", repositories.billing, billing, "billingId", "billing-1", "입금 확인", "고객 · 운영 계약 · 착수금", "청구 참고 · 청구번호 B-1", "입금 확정 — 금액 고정, 세금계산서 발행 없음"],
] as const;
const detailRoutes = [
  ["expense", "@/app/(private)/expenses/[entryId]/page", repositories.expense, "entryId", "expense-1"],
  ["revenue", "@/app/(private)/revenue/[entryId]/page", repositories.revenue, "entryId", "revenue-1"],
  ["billing", "@/app/(private)/billings/[billingId]/page", repositories.billing, "billingId", "billing-1"],
  ["contract", "@/app/(private)/contracts/[contractId]/page", repositories.contract, "contractId", "contract-1"],
  ["proposal", "@/app/(private)/proposals/[proposalId]/page", repositories.proposal, "proposalId", "proposal-1"],
  ["agent", "@/app/(private)/agents/[agentId]/page", repositories.agent, "agentId", "agent-1"],
] as const;

async function page(path: string, param: string, value: string) {
  const { default: Page } = await import(/* @vite-ignore */ path);
  return Page({ params: Promise.resolve({ [param]: value }) } as never);
}
function reviewCard() {
  return within(screen.getByRole("region", { name: "확정 전 확인" }));
}
function expectReview({ subject, amount, evidence, outcome }: { subject: string; amount: string; evidence: string; outcome: string }) {
  const card = reviewCard();
  expect(card.getByText(subject)).toBeTruthy();
  expect(card.getByText(amount)).toBeTruthy();
  expect(card.getByText(evidence)).toBeTruthy();
  expect(card.getByText(outcome)).toBeTruthy();
}
function expectApprovalForm(button: string, idName: string, id: string) {
  const form = screen.getByRole("button", { name: button }).closest("form")!;
  const approved = form.querySelector("input[name=approved]") as HTMLInputElement | null;
  expect(approved?.required).toBe(true);
  expect(approved?.value).toBe("true");
  expect((form.querySelector(`input[name=${idName}]`) as HTMLInputElement | null)?.value).toBe(id);
}
afterEach(() => {
  expect(Object.values(actions).every(action => !action.mock.calls.length)).toBe(true);
  cleanup(); auth.state = "authorized";
  Object.values(repositories).forEach(mock => mock.mockReset());
  Object.values(actions).forEach(mock => mock.mockReset());
});

describe("approval detail pages", () => {
  it.each(pages)("renders pending %s review fields and required approval", async (_name, path, repository, fixture, param, id, button, subject, evidence, outcome) => {
    repository.mockResolvedValue(fixture());
    render(await page(path, param, id));
    expect(screen.getByRole("link", { name: "승인함" }).getAttribute("href")).toBe("/approvals");
    expectReview({ subject, amount: "KRW · 0원", evidence, outcome });
    expectApprovalForm(button, param, id);
    expect(Object.values(actions).every(action => !action.mock.calls.length)).toBe(true);
  });

  it.each(pages)("removes stale %s approval controls after decision", async (_name, path, repository, fixture, param, id, button) => {
    repository.mockResolvedValue(fixture(_name === "billing" ? "deposited" : "confirmed"));
    render(await page(path, param, id));
    expect(screen.queryByRole("button", { name: button })).toBeNull();
    expect(screen.queryByRole("heading", { name: "확정 전 확인" })).toBeNull();
  });

  it.each(detailRoutes)("blocks signed-out and denied %s before repository access", async (_name, path, repository, param, id) => {
    auth.state = "signed-out";
    await expect(page(path, param, id)).rejects.toThrow("redirect:/sign-in");
    auth.state = "denied";
    await expect(page(path, param, id)).rejects.toThrow("redirect:/dashboard");
    expect(repository).not.toHaveBeenCalled();
  });

  it.each(pages)("uses notFound for missing %s", async (_name, path, repository, _fixture, param, id) => {
    repository.mockResolvedValue(null);
    await expect(page(path, param, id)).rejects.toThrow("not-found");
  });

  it("renders contract execution review and does not offer it without an original", async () => {
    repositories.contract.mockResolvedValue(contract());
    render(await page("@/app/(private)/contracts/[contractId]/page", "contractId", "contract-1"));
    expect(screen.getByRole("link", { name: "승인함" }).getAttribute("href")).toBe("/approvals");
    expectReview({ subject: "운영 계약 · 고객", amount: "KRW · 0원", evidence: "날인 원본 위치: 문서함/날인본.pdf", outcome: "최종 계약 체결 — 이 버전 덮어쓰기 금지" });
    expectApprovalForm("최종 계약으로 체결", "contractId", "contract-1");
    cleanup(); repositories.contract.mockResolvedValue(contract("draft", null));
    render(await page("@/app/(private)/contracts/[contractId]/page", "contractId", "contract-1"));
    expect(screen.queryByRole("button", { name: "최종 계약으로 체결" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "확정 전 확인" })).toBeNull();
  });

  it("requires proposal rejection reason and keeps its review amount absent", async () => {
    repositories.proposal.mockResolvedValue(proposal());
    render(await page("@/app/(private)/proposals/[proposalId]/page", "proposalId", "proposal-1"));
    expect(screen.getByRole("link", { name: "승인함" }).getAttribute("href")).toBe("/approvals");
    expectReview({ subject: "현재 합의 · 고객 · 프로젝트 · 범위를 확정합니다", amount: "금액 없음", evidence: "메일 · 2026-09-01 10:00 · 원문 제목 · 원문 식별자 source-1", outcome: "제안 확정 — 공식 결정으로 기록, 자동 실행 없음" });
    expectApprovalForm("제안 확정", "proposalId", "proposal-1");
    expectApprovalForm("제안 반려", "proposalId", "proposal-1");
    expect((screen.getByRole("textbox", { name: "반려 사유" }) as HTMLTextAreaElement).required).toBe(true);
  });

  it("requires an agent result before approval and shows no amount", async () => {
    repositories.agent.mockResolvedValue(agent());
    render(await page("@/app/(private)/agents/[agentId]/page", "agentId", "agent-1"));
    expect(screen.getByRole("link", { name: "승인함" }).getAttribute("href")).toBe("/approvals");
    expectReview({ subject: "검토 요청", amount: "금액 없음", evidence: "입력 자료: 입력 참고", outcome: "작업 이력 승인 — 기록 고정, 자동 실행 없음" });
    expectApprovalForm("이력 승인", "agentId", "agent-1");
    expectApprovalForm("이력 반려", "agentId", "agent-1");
    expect((screen.getByRole("textbox", { name: "결과" }) as HTMLTextAreaElement).required).toBe(true);
    expect((screen.getByRole("textbox", { name: "반려 사유" }) as HTMLTextAreaElement).required).toBe(true);
  });

  it.each([
    ["contract", "@/app/(private)/contracts/[contractId]/page", repositories.contract, "contractId", "contract-1"],
    ["proposal", "@/app/(private)/proposals/[proposalId]/page", repositories.proposal, "proposalId", "proposal-1"],
    ["agent", "@/app/(private)/agents/[agentId]/page", repositories.agent, "agentId", "agent-1"],
  ] as const)("blocks missing %s before rendering", async (_name, path, repository, param, id) => {
    repository.mockResolvedValue(null);
    await expect(page(path, param, id)).rejects.toThrow("not-found");
  });

  it("removes contract, proposal, and agent pending controls after their decisions", async () => {
    repositories.contract.mockResolvedValue(contract("executed"));
    render(await page("@/app/(private)/contracts/[contractId]/page", "contractId", "contract-1"));
    expect(screen.queryByRole("button", { name: "최종 계약으로 체결" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "확정 전 확인" })).toBeNull();
    cleanup(); repositories.proposal.mockResolvedValue(proposal("confirmed"));
    render(await page("@/app/(private)/proposals/[proposalId]/page", "proposalId", "proposal-1"));
    expect(screen.queryByRole("button", { name: "제안 확정" })).toBeNull();
    expect(screen.queryByRole("button", { name: "제안 반려" })).toBeNull();
    cleanup(); repositories.agent.mockResolvedValue(agent(false));
    render(await page("@/app/(private)/agents/[agentId]/page", "agentId", "agent-1"));
    expect(screen.queryByRole("button", { name: "이력 승인" })).toBeNull();
    expect(screen.queryByRole("button", { name: "이력 반려" })).toBeNull();
  });
});
