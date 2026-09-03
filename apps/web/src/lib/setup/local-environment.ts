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

const developmentDatabaseSetupSchema = z.object({
  databaseUrl: singleLine("개발 데이터베이스 연결 문자열을 입력해 주세요.").refine(
    (value) => {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    },
    "PostgreSQL 연결 문자열을 입력해 주세요.",
  ),
});

export type DevelopmentDatabaseSetup = z.infer<typeof developmentDatabaseSetupSchema>;

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

export function parseDevelopmentDatabaseSetup(input: unknown): DevelopmentDatabaseSetup {
  const parsed = developmentDatabaseSetupSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  return parsed.data;
}

export function appendDevelopmentDatabaseConfig(existing: string, values: DevelopmentDatabaseSetup) {
  if (/^(DATABASE_URL|CORELOOM_DATABASE_BRANCH)=/m.test(existing)) {
    throw new Error("기존 개발 데이터베이스 설정은 보호했습니다.");
  }

  const prefix = existing.endsWith("\n") ? existing : `${existing}\n`;

  return `${prefix}DATABASE_URL=${JSON.stringify(values.databaseUrl)}\nCORELOOM_DATABASE_BRANCH="ai-development"\n`;
}

const quoteEmailSetupSchema = z.object({
  apiKey: singleLine("Resend API 키를 입력해 주세요.").regex(/^re_/, "Resend API 키 형식을 확인해 주세요."),
});

export type QuoteEmailSetup = z.infer<typeof quoteEmailSetupSchema>;

export function parseQuoteEmailSetup(input: unknown): QuoteEmailSetup {
  const parsed = quoteEmailSetupSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.");
  }

  return parsed.data;
}

export function appendQuoteEmailConfig(existing: string, values: QuoteEmailSetup) {
  if (/^(RESEND_API_KEY|CORELOOM_QUOTE_FROM)=/m.test(existing)) {
    throw new Error("기존 이메일 발송 설정은 보호했습니다.");
  }

  const prefix = existing.endsWith("\n") ? existing : `${existing}\n`;

  return `${prefix}RESEND_API_KEY=${JSON.stringify(values.apiKey)}\nCORELOOM_QUOTE_FROM="onboarding@resend.dev"\n`;
}
