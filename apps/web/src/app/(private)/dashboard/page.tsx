import { redirect } from "next/navigation";

import { founderSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

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

  return (
    <main className="dashboard-shell">
      <p className="auth-eyebrow">CORELOOM / PRIVATE</p>
      <h1>운영 기반이 준비되었습니다.</h1>
      <p>{session.founder.email} 계정으로 로그인했습니다. 회사 설립 준비와 고객사·프로젝트 운영 기능을 다음 단계에서 연결합니다.</p>
      <a className="auth-submit dashboard-action" href="/company-setup">회사 설립 준비 시작</a>
      <a className="text-link" href="/clients-projects">고객사와 프로젝트 관리</a>
    </main>
  );
}
