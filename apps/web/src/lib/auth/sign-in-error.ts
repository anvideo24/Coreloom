import { isLoopbackHost } from "@/lib/auth/funnel-origin";

export function signInFailureMessage(
  error: { status?: number; code?: string; message?: string } | null,
  locationHost?: string | null,
) {
  const blockedOrigin = error?.status === 0
    || error?.status === 403
    || error?.code === "INVALID_ORIGIN"
    || error?.message === "Invalid origin";
  if (blockedOrigin) {
    if (isLoopbackHost(locationHost)) {
      return "이 PC 주소에서 로그인이 막혔습니다. http://localhost:3000/sign-in 으로 다시 열어 주세요. 그래도 막히면 Neon Console Auth 신뢰 도메인에 http://127.0.0.1:3000 을 넣어 주세요.";
    }
    return "이 주소에서 로그인이 막혔습니다. PC의 localhost에서 같은 계정으로 열리는지 확인한 뒤, Neon Console Auth 신뢰 도메인에 휴대폰 HTTPS 주소를 넣어 주세요.";
  }

  return "로그인 정보를 확인해 주세요.";
}
