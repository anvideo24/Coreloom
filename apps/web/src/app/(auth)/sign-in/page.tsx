import { SignInForm } from "@/components/sign-in-form";

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <section aria-labelledby="sign-in-title" className="auth-card">
        <p className="auth-eyebrow">PRIVATE OPERATING SYSTEM</p>
        <h1 id="sign-in-title">Coreloom</h1>
        <p className="auth-intro">대표 전용 회사 운영 공간입니다. 승인된 계정으로만 계속할 수 있습니다.</p>
        <SignInForm />
        <p className="auth-help">처음 접근하는 경우, Neon Console에서 대표 계정을 먼저 만들어 주세요.</p>
      </section>
    </main>
  );
}
