"use client";

import { FormEvent, useState } from "react";

function createCookieSecret() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function LocalSetupForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cookieSecret, setCookieSecret] = useState("");

  async function saveLocalSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/local-setup", {
      body: JSON.stringify({
        databaseUrl: String(formData.get("databaseUrl") ?? ""),
        authBaseUrl: String(formData.get("authBaseUrl") ?? ""),
        cookieSecret: String(formData.get("cookieSecret") ?? ""),
        founderEmail: String(formData.get("founderEmail") ?? ""),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = await response.json() as { message?: string };

    if (!response.ok) {
      setError(result.message ?? "설정을 저장할 수 없습니다.");
      setIsSubmitting(false);
      return;
    }

    setMessage(result.message ?? "이 PC의 개발 설정을 저장했습니다.");
    setIsSubmitting(false);
  }

  return (
    <form className="auth-form" onSubmit={saveLocalSetup}>
      <label className="auth-label" htmlFor="databaseUrl">개발 데이터베이스 연결 문자열</label>
      <input autoComplete="off" className="auth-input" id="databaseUrl" name="databaseUrl" required type="password" />

      <label className="auth-label" htmlFor="authBaseUrl">Neon Auth 주소</label>
      <input autoComplete="off" className="auth-input" id="authBaseUrl" name="authBaseUrl" placeholder="https://…" required type="url" />

      <label className="auth-label" htmlFor="founderEmail">대표 이메일</label>
      <input autoComplete="email" className="auth-input" id="founderEmail" name="founderEmail" required type="email" />

      <label className="auth-label" htmlFor="cookieSecret">쿠키 비밀값</label>
      <input autoComplete="new-password" className="auth-input" id="cookieSecret" minLength={32} name="cookieSecret" onChange={(event) => setCookieSecret(event.target.value)} required type="password" value={cookieSecret} />
      <button className="auth-link" onClick={() => setCookieSecret(createCookieSecret())} type="button">비밀값 자동 생성</button>

      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {message ? <p className="auth-notice" role="status">{message}</p> : null}

      <button className="auth-submit" disabled={isSubmitting || Boolean(message)} type="submit">
        {isSubmitting ? "저장 중…" : "이 PC에 개발 설정 저장"}
      </button>
    </form>
  );
}
