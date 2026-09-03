export function passwordResetRedirectUrl(origin: string) {
  return new URL("/auth/reset-password", origin).toString();
}

export function validateNewPassword(password: string, confirmation: string) {
  return password === confirmation ? null : "비밀번호가 일치하지 않습니다.";
}

export function passwordResetCompleteMessage(status?: string) {
  return status === "1" ? "비밀번호가 설정됐습니다. 새 비밀번호로 로그인해 주세요." : null;
}
