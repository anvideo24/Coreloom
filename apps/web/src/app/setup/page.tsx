import { notFound } from "next/navigation";

import { LocalSetupForm } from "@/components/local-setup-form";

export default function LocalSetupPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="auth-shell">
      <section aria-labelledby="local-setup-title" className="auth-card">
        <p className="auth-eyebrow">LOCAL DEVELOPMENT ONLY</p>
        <h1 id="local-setup-title">처음 설정</h1>
        <p className="auth-intro">대표 로그인에 필요한 Coreloom 개발 연결 정보만 저장합니다. 값은 저장소에 올라가지 않습니다.</p>
        <LocalSetupForm />
        <p className="auth-help">저장 뒤 개발 서버를 다시 시작하면 대표 로그인 화면을 사용할 수 있습니다.</p>
      </section>
    </main>
  );
}
