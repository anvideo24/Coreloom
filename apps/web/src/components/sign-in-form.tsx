"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth/client";
import { signInFailureMessage } from "@/lib/auth/sign-in-error";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInFailureMessage(signInError, window.location.hostname));
        return;
      }
      router.push("/dashboard");
    } catch {
      setError(signInFailureMessage({ status: 0 }, window.location.hostname));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={signIn}>
      <label className="auth-label" htmlFor="email">
        대표 이메일
      </label>
      <input autoComplete="email" className="auth-input" id="email" name="email" required type="email" />

      <label className="auth-label" htmlFor="password">
        비밀번호
      </label>
      <input
        autoComplete="current-password"
        className="auth-input"
        id="password"
        name="password"
        required
        type="password"
      />

      {error ? <p className="auth-error" role="alert">{error}</p> : null}

      <button className="auth-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "확인 중…" : "Coreloom 열기"}
      </button>

      <Link className="auth-link" href="/auth/forgot-password">
        비밀번호 설정 또는 재설정
      </Link>
    </form>
  );
}
