import { notFound } from "next/navigation";

import { QuoteEmailSetupForm } from "@/components/quote-email-setup-form";

export default function QuoteEmailSetupPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <main className="auth-shell"><section aria-labelledby="quote-email-setup-title" className="auth-card"><p className="auth-eyebrow">LOCAL DEVELOPMENT ONLY</p><h1 id="quote-email-setup-title">견적 이메일 연결</h1><p className="auth-intro">Resend API 키만 이 PC에 저장합니다. 테스트 발신 주소는 Resend의 기본 주소를 사용하며, 저장소와 채팅에는 남지 않습니다.</p><QuoteEmailSetupForm /><p className="auth-help">저장 뒤 개발 서버를 다시 시작하면 본인 이메일로 테스트 발송할 수 있습니다.</p></section></main>;
}
