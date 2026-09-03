import { describe, expect, it } from "vitest";

import {
  passwordResetCompleteMessage,
  passwordResetRedirectUrl,
  validateNewPassword,
} from "@/lib/auth/password-reset";

describe("password reset helpers", () => {
  it("returns the Coreloom reset page under the current application origin", () => {
    expect(passwordResetRedirectUrl("http://localhost:3111")).toBe("http://localhost:3111/auth/reset-password");
  });

  it("does not accept mismatched passwords", () => {
    expect(validateNewPassword("secure-one", "secure-two")).toBe("비밀번호가 일치하지 않습니다.");
  });

  it("accepts matching passwords for the Auth service to validate", () => {
    expect(validateNewPassword("correct horse battery staple", "correct horse battery staple")).toBeNull();
  });

  it("shows a sign-in confirmation only after a completed password reset", () => {
    expect(passwordResetCompleteMessage("1")).toBe("비밀번호가 설정됐습니다. 새 비밀번호로 로그인해 주세요.");
    expect(passwordResetCompleteMessage()).toBeNull();
  });
});
