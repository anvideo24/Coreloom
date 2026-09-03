import Link from "next/link";

import { PasswordResetForm } from "@/components/password-reset-form";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  return (
    <main className="auth-shell">
      <section aria-labelledby="reset-password-title" className="auth-card">
        <p className="auth-eyebrow">PRIVATE OPERATING SYSTEM</p>
        <h1 id="reset-password-title">새 비밀번호</h1>
        <p className="auth-intro">이 기기에서만 사용할 새 비밀번호를 정해 주세요.</p>
        <PasswordResetForm token={token} />
        <p className="auth-help"><Link href="/auth/forgot-password">새 링크 요청하기</Link></p>
      </section>
    </main>
  );
}
