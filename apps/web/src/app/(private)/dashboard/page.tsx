import Link from "next/link";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { getFounderDashboard } from "@/lib/dashboard/repository";
import type { DashboardLink } from "@/lib/domain/dashboard";

export const dynamic = "force-dynamic";

function DashboardList({
  code,
  heading,
  items,
  empty,
}: {
  code: string;
  heading: string;
  items: DashboardLink[];
  empty: string;
}) {
  return (
    <section aria-label={heading} className="quote-list">
      <div className="list-heading">
        <div>
          <p className="setup-code">{code}</p>
          <h2>{heading}</h2>
        </div>
        <span>{items.length}건</span>
      </div>
      {items.length === 0 ? <p className="empty-state">{empty}</p> : items.map((item) => (
        <Link className="quote-row" href={item.href} key={`${item.href}-${item.title}-${item.detail}`}>
          <div>
            <p>{item.detail}</p>
            <h3>{item.title}</h3>
          </div>
          {typeof item.amount === "number" ? <strong>{item.amount.toLocaleString("ko-KR")}원</strong> : null}
        </Link>
      ))}
    </section>
  );
}

export default async function DashboardPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");

  if (session.state === "denied") {
    return (
      <main className="auth-shell">
        <section aria-labelledby="access-denied-title" className="auth-card">
          <p className="auth-eyebrow">ACCESS DENIED</p>
          <h1 id="access-denied-title">대표 계정이 아닙니다</h1>
          <p className="auth-intro">이 계정에는 Coreloom 운영 권한이 없습니다.</p>
        </section>
      </main>
    );
  }

  const dashboard = await getFounderDashboard(session.founder.id);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / DASHBOARD</p>
          <h1>오늘 확인할 운영</h1>
          <p>설립 준비와 오늘 확인할 견적·계약·청구·비용 지급·AI 제안을 먼저 봅니다. 이 화면은 조회만 하며, 발송·체결·입금 확정·비용 확정은 각 화면에서 대표가 직접 합니다.</p>
        </div>
      </header>

      <section aria-label="설립 준비 진행률" className="progress-card">
        <div>
          <p>설립 준비 · {dashboard.today}</p>
          <strong>{dashboard.setupProgress}%</strong>
        </div>
        <div aria-hidden="true" className="progress-track"><span style={{ width: `${dashboard.setupProgress}%` }} /></div>
        <Link className="text-link" href="/company-setup">설립 준비 화면으로 이동</Link>
      </section>

      <DashboardList code="증빙" heading="증빙 누락" items={dashboard.evidenceGaps} empty="증빙 위치가 비어 있는 진행·완료 항목이 없습니다." />
      <DashboardList code="설립 준비" heading="확인할 설립 항목" items={dashboard.openSetupItems} empty="시작 전이거나 진행 중인 설립 항목이 없습니다." />

      <DashboardList code="오늘" heading="견적 발송" items={dashboard.quotesToSend} empty="메일 요청이 없는 최신 견적 버전이 없습니다." />
      <DashboardList code="오늘" heading="계약 체결" items={dashboard.contractsToExecute} empty="체결 전 계약이 없습니다." />
      <DashboardList code="오늘" heading="청구 · 입금" items={dashboard.billingsToCheck} empty="오늘 확인할 청구·입금 예정이 없습니다." />
      <DashboardList code="오늘" heading="비용 지급" items={dashboard.expensesToCheck} empty="오늘 확인할 비용 지급 예정이 없습니다." />
      <DashboardList code="오늘" heading="AI 확인 요청" items={dashboard.proposalsToReview} empty="확정 전 AI 제안이 없습니다." />

      <section aria-label="매출 요약" className="progress-card">
        <div>
          <p>매출 원장</p>
          <strong>{dashboard.revenue.confirmedAmount.toLocaleString("ko-KR")}원</strong>
        </div>
        <p className="form-help">확정 {dashboard.revenue.confirmedAmount.toLocaleString("ko-KR")}원 · 예정 {dashboard.revenue.scheduledAmount.toLocaleString("ko-KR")}원 · 미분류 {dashboard.revenue.unclassifiedCount}건</p>
        <Link className="text-link" href="/revenue">매출 원장으로 이동</Link>
      </section>

      <section aria-label="비용 요약" className="progress-card">
        <div>
          <p>비용 원장</p>
          <strong>{dashboard.expenses.confirmedAmount.toLocaleString("ko-KR")}원</strong>
        </div>
        <p className="form-help">확정 {dashboard.expenses.confirmedAmount.toLocaleString("ko-KR")}원 · 예정 {dashboard.expenses.scheduledAmount.toLocaleString("ko-KR")}원 · 미분류 {dashboard.expenses.unclassifiedCount}건</p>
        <Link className="text-link" href="/expenses">비용 원장으로 이동</Link>
      </section>

      <DashboardList code="프로젝트" heading="진행 중 고객사 프로젝트" items={dashboard.activeProjects} empty="진행·예정·보류 중인 프로젝트가 없습니다." />
      <DashboardList code="일정" heading="업무 일정" items={dashboard.schedule} empty="진행 중인 업무가 없습니다." />
      <DashboardList code="결정" heading="최근 결정" items={dashboard.recentDecisions} empty="확정하거나 반려한 AI 제안이 아직 없습니다." />

      <section aria-label="문서 보관 상태" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">문서함</p>
            <h2>원본 위치 보관</h2>
          </div>
          <span>{dashboard.documentCount}건</span>
        </div>
        <Link className="quote-row" href="/documents">
          <div>
            <p>파일 업로드는 포함하지 않습니다.</p>
            <h3>비공개 문서함</h3>
          </div>
          <strong>{dashboard.documentCount}건</strong>
        </Link>
      </section>
    </main>
  );
}
