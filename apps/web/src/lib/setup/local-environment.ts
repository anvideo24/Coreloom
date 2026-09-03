import { z } from "zod";

const singleLine = (message: string) => z.string().trim().min(1, message).refine(
  (value) => !/[\r\n]/.test(value),
  "줄바꿈은 입력할 수 없습니다.",
);

const localSetupSchema = z.object({
  founderEmail: z.string().trim().email("대표 이메일 형식을 확인해 주세요."),
  authBaseUrl: singleLine("Neon Auth 주소를 입력해 주세요.").url("Neon Auth 주소 형식을 확인해 주세요.").refine(
    (value) => new URL(value).protocol === "https:",
    "Neon Auth 주소는 HTTPS여야 합니다.",
  ),
  cookieSecret: singleLine("쿠키 비밀값을 입력해 주세요.").min(32, "쿠키 비밀값은 32자 이상이어야 합니다."),
});

export type LocalSetup = z.infer<typeof localSetupSchema>;

export function parseLocalSetup(input: unknown): LocalSetup {
  const parsed = localSetupSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  return parsed.data;
}

export function localEnvironmentFile(values: LocalSetup) {
  return [
    `NEON_AUTH_BASE_URL=${JSON.stringify(values.authBaseUrl)}`,
    `NEON_AUTH_COOKIE_SECRET=${JSON.stringify(values.cookieSecret)}`,
    `CORELOOM_FOUNDER_EMAIL=${JSON.stringify(values.founderEmail)}`,
    "",
  ].join("\n");
}
