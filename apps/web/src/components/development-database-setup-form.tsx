"use client";

import { FormEvent, useState } from "react";

export function DevelopmentDatabaseSetupForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function saveDevelopmentDatabase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const databaseUrl = String(new FormData(event.currentTarget).get("databaseUrl") ?? "");
    const response = await fetch("/api/local-database", {
      body: JSON.stringify({ databaseUrl }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = await response.json() as { message?: string };

    if (!response.ok) {
      setError(result.message ?? "개발 데이터베이스 연결을 저장할 수 없습니다.");
      setIsSubmitting(false);
      return;
    }

    setMessage(result.message ?? "개발 데이터베이스 연결을 저장했습니다.");
    setIsSubmitting(false);
  }

  return (
    <form className="auth-form" onSubmit={saveDevelopmentDatabase}>
      <label className="auth-label" htmlFor="databaseUrl">ai-development 연결 문자열</label>
      <input autoComplete="off" className="auth-input" id="databaseUrl" name="databaseUrl" required type="password" />
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {message ? <p className="auth-notice" role="status">{message}</p> : null}
      <button className="auth-submit" disabled={isSubmitting || Boolean(message)} type="submit">
        {isSubmitting ? "저장 중…" : "이 PC에 개발 DB 연결 저장"}
      </button>
    </form>
  );
}
