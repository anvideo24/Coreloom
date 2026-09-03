"use client";

import { FormEvent, useState } from "react";

export function QuoteEmailSetupForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function saveQuoteEmailSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    const apiKey = String(new FormData(event.currentTarget).get("apiKey") ?? "");
    const response = await fetch("/api/local-quote-email", { body: JSON.stringify({ apiKey }), headers: { "Content-Type": "application/json" }, method: "POST" });
    const result = await response.json() as { message?: string };
    if (!response.ok) {
      setError(result.message ?? "이메일 발송 설정을 저장할 수 없습니다.");
      setIsSubmitting(false);
      return;
    }
    setMessage(result.message ?? "이 PC의 이메일 발송 설정을 저장했습니다.");
    setIsSubmitting(false);
  }

  return <form className="auth-form" onSubmit={saveQuoteEmailSetup}><label className="auth-label" htmlFor="apiKey">Resend API 키</label><input autoComplete="off" className="auth-input" id="apiKey" name="apiKey" required type="password" />{error ? <p className="auth-error" role="alert">{error}</p> : null}{message ? <p className="auth-notice" role="status">{message}</p> : null}<button className="auth-submit" disabled={isSubmitting || Boolean(message)} type="submit">이 PC에 이메일 발송 설정 저장</button></form>;
}
