import Link from "next/link";

import { PasswordResetRequestForm } from "@/components/password-reset-request-form";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-shell">
      <section aria-labelledby="forgot-password-title" className="auth-card">
        <p className="auth-eyebrow">PRIVATE OPERATING SYSTEM</p>
        <h1 id="forgot-password-title">비밀번호 설정</h1>
        <p className="auth-intro">대표 이메일로 비밀번호 설정 링크를 요청합니다.</p>
        <PasswordResetRequestForm />
        <p className="auth-help"><Link href="/sign-in">로그인으로 돌아가기</Link></p>
      </section>
    </main>
  );
}
