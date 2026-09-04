import Link from "next/link";
import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";
import { getFounderDashboard } from "@/lib/dashboard/repository";
import type { DashboardCashWeek, DashboardInboxItem, DashboardProjectCard } from "@/lib/domain/dashboard";

export const dynamic = "force-dynamic";

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function CashWeekChart({ weeks }: { weeks: DashboardCashWeek[] }) {
  const max = Math.max(1, ...weeks.flatMap((week) => [week.inflow, week.outflow]));
  const width = 360;
  const height = 150;
  const left = 8;
  const right = 8;
  const top = 12;
  const bottom = 24;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const step = weeks.length > 1 ? innerWidth / (weeks.length - 1) : innerWidth;
  const points = weeks.map((week, index) => ({
    x: left + index * step,
    inflowY: top + innerHeight - (week.inflow / max) * innerHeight,
    outflowY: top + innerHeight - (week.outflow / max) * innerHeight,
    label: week.label,
  }));
  const inflowLine = points.map((point) => `${point.x},${point.inflowY}`).join(" ");
  const outflowLine = points.map((point) => `${point.x},${point.outflowY}`).join(" ");
  const area = `${left},${top + innerHeight} ${inflowLine} ${left + innerWidth},${top + innerHeight}`;

  return (
    <svg aria-hidden="true" className="dash-area" viewBox={`0 0 ${width} ${height}`}>
      <polygon className="inflow" points={area} />
      <polyline className="inflow" fill="none" points={inflowLine} />
      <polyline className="outflow" points={outflowLine} />
      {points.map((point) => (
        <text key={point.label} x={point.x} y={height - 6}>{point.label}</text>
      ))}
    </svg>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <svg aria-hidden="true" className="dash-ring" viewBox="0 0 72 72">
      <circle className="track" cx="36" cy="36" r={radius} />
      <circle className="value" cx="36" cy="36" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      <text x="36" y="41">{value}%</text>
    </svg>
  );
}

function InboxCard({ item }: { item: DashboardInboxItem }) {
  return (
    <Link className="dash-inbox-item" href={item.href}>
      <span className={item.overdue ? "dash-chip dash-chip-overdue" : "dash-chip"}>{item.kindLabel}</span>
      {item.when ? <time dateTime={item.when}>{item.overdue ? `${item.when} · 지남` : item.when}</time> : null}
      <h3>{item.title}</h3>
      <p>{item.detail}</p>
      {typeof item.amount === "number" ? <strong>{formatWon(item.amount)}</strong> : null}
    </Link>
  );
}

function ProjectCard({ project }: { project: DashboardProjectCard }) {
  return (
    <Link className="dash-project" href={project.href}>
      <div>
        <p>{project.clientName} · {project.statusLabel}</p>
        <h3>{project.title}</h3>
        <div className="dash-stages">
          <span className="dash-stage" data-done={project.stages.quote}> <i />견적</span>
          <span className="dash-stage" data-done={project.stages.contract}> <i />계약</span>
          <span className="dash-stage" data-done={project.stages.billing}> <i />청구</span>
        </div>
        <p>다음 할 일 · {project.nextAction}</p>
      </div>
      <ProgressRing value={project.progressPercent} />
    </Link>
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
  const inflowTotal = dashboard.cashWeeks.reduce((sum, week) => sum + week.inflow, 0);
  const outflowTotal = dashboard.cashWeeks.reduce((sum, week) => sum + week.outflow, 0);
  const timeline = dashboard.inbox.slice(0, 3);

  return (
    <main className="operations-shell dash-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / DASHBOARD</p>
          <h1>오늘 확인할 운영</h1>
          <p>승인 대기·오늘 할 일·진행 프로젝트와 이번 달 입금·지급을 먼저 봅니다. 이 화면은 조회만 하며, 발송·체결·입금 확정·비용 확정은 각 화면에서 대표가 직접 합니다.</p>
        </div>
      </header>

      <section aria-label="운영 바이탈" className="dash-vitals">
        <div className="dash-vital">
          <p>승인 대기</p>
          <strong>{dashboard.vitals.pendingApprovals}</strong>
        </div>
        <div className="dash-vital">
          <p>오늘 업무</p>
          <strong>{dashboard.vitals.todayTasks}</strong>
        </div>
        <div className="dash-vital">
          <p>연체 입금</p>
          <strong>{dashboard.vitals.overdueDeposits}</strong>
        </div>
        <div className="dash-vital">
          <p>미분류</p>
          <strong>{dashboard.vitals.unclassified}</strong>
        </div>
        <div className="dash-vital">
          <p>현금 리듬</p>
          <strong>{dashboard.vitals.cashRhythm === "watch" ? "주의" : "정상"}</strong>
          <svg aria-hidden="true" className="dash-pulse" viewBox="0 0 72 24">
            <polyline fill="none" points="0,14 10,14 14,6 20,20 26,12 36,12 40,4 48,18 54,12 72,12" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span>{dashboard.vitals.cashRhythm === "watch" ? "기한이 지난 입금 또는 업무가 있습니다" : "기한이 지난 입금·업무가 없습니다"}</span>
        </div>
      </section>

      <div className="dash-main">
        <section aria-label="이번 달 입금과 지급" className="dash-card dash-chart">
          <div className="dash-card-head">
            <h2>이번 달 입금 · 지급</h2>
            <span>{dashboard.today.slice(0, 7)}</span>
          </div>
          <CashWeekChart weeks={dashboard.cashWeeks} />
          <div className="dash-chart-totals">
            <strong>입금 예정 {formatWon(inflowTotal)}</strong>
            <p>지급 예정 {formatWon(outflowTotal)} · 확정 매출 {formatWon(dashboard.revenue.confirmedAmount)}</p>
            <Link className="stat-card-link" href="/revenue">매출 원장 →</Link>
          </div>
        </section>

        <section aria-label="오늘 할 일" className="dash-card">
          <div className="dash-card-head">
            <h2>오늘 할 일</h2>
            <span>{dashboard.inbox.length}건</span>
          </div>
          {timeline.length === 0 ? <p className="empty-state">오늘 확인할 견적·계약·청구·업무가 없습니다.</p> : (
            <div className="dash-timeline">
              <div className="dash-nodes">
                {timeline.map((item) => (
                  <span className="dash-node" key={item.id}><i />{item.kindLabel}</span>
                ))}
              </div>
              {timeline.map((item) => <InboxCard item={item} key={item.id} />)}
            </div>
          )}
        </section>
      </div>

      <section aria-label="진행 중 프로젝트" className="dash-section">
        <div className="list-heading">
          <h2>진행 중 프로젝트</h2>
          <span>{dashboard.projectCards.length}건</span>
        </div>
        {dashboard.projectCards.length === 0 ? (
          <p className="empty-state">진행·예정·보류 중인 프로젝트가 없습니다.</p>
        ) : (
          <div className="dash-projects">
            {dashboard.projectCards.map((project) => <ProjectCard key={project.href} project={project} />)}
          </div>
        )}
      </section>

      <section aria-label="이번 주 일정" className="dash-week">
        <p className="stat-card-label">이번 주 일정</p>
        <div className="dash-week-days">
          {dashboard.weekDays.map((day) => (
            <span className="dash-week-day" data-today={day.isToday} key={day.date}>
              {day.label}
              <b>{day.count}</b>
            </span>
          ))}
        </div>
        <Link className="text-link" href="/tasks">전체 일정 보기</Link>
      </section>

      {dashboard.setupProgress < 100 ? (
        <section aria-label="설립 준비 진행률" className="progress-card">
          <div>
            <p>설립 준비 · {dashboard.today}</p>
            <strong>{dashboard.setupProgress}%</strong>
          </div>
          <div aria-hidden="true" className="progress-track"><span style={{ width: `${dashboard.setupProgress}%` }} /></div>
          <Link className="text-link" href="/company-setup">설립 준비 화면으로 이동</Link>
        </section>
      ) : null}

      {dashboard.inbox.length > 3 ? (
        <section aria-label="나머지 할 일" className="quote-list dash-decisions">
          <div className="list-heading">
            <h2>이어서 확인할 일</h2>
            <span>{dashboard.inbox.length - 3}건</span>
          </div>
          {dashboard.inbox.slice(3).map((item) => (
            <Link className="quote-row" href={item.href} key={item.id}>
              <div>
                <p>{item.kindLabel} · {item.detail}</p>
                <h3>{item.title}</h3>
              </div>
              {typeof item.amount === "number" ? <strong>{formatWon(item.amount)}</strong> : null}
            </Link>
          ))}
        </section>
      ) : null}

      {dashboard.recentDecisions.length > 0 ? (
        <section aria-label="최근 결정" className="quote-list dash-decisions">
          <div className="list-heading">
            <h2>최근 결정</h2>
            <span>{dashboard.recentDecisions.length}건</span>
          </div>
          {dashboard.recentDecisions.map((item) => (
            <Link className="quote-row" href={item.href} key={item.href}>
              <div>
                <p>{item.detail}</p>
                <h3>{item.title}</h3>
              </div>
            </Link>
          ))}
        </section>
      ) : null}
    </main>
  );
}
