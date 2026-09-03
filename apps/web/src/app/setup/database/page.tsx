import { notFound } from "next/navigation";

import { DevelopmentDatabaseSetupForm } from "@/components/development-database-setup-form";

export default function DevelopmentDatabaseSetupPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="auth-shell">
      <section aria-labelledby="database-setup-title" className="auth-card">
        <p className="auth-eyebrow">LOCAL DEVELOPMENT ONLY</p>
        <h1 id="database-setup-title">개발 DB 연결</h1>
        <p className="auth-intro">Neon의 ai-development 연결 문자열만 이 PC에 추가합니다. 기존 로그인 설정은 바꾸지 않습니다.</p>
        <DevelopmentDatabaseSetupForm />
      </section>
    </main>
  );
}
