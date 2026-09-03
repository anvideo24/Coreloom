export function signInFailureMessage(error: { status?: number } | null) {
  if (error?.status === 0 || error?.status === 403) {
    return "이 주소에서 로그인이 막혔습니다. PC의 localhost에서 같은 계정으로 열리는지 확인한 뒤, Neon Console Auth 신뢰 도메인에 휴대폰 HTTPS 주소를 넣어 주세요.";
  }

  return "로그인 정보를 확인해 주세요.";
}
