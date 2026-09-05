import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isUniqueViolationError } from "@/lib/db/postgres-errors";

/**
 * F02-03 서버 배선 시험.
 *
 * DB에 붙을 수 없으므로(과제 규칙), 저장 계층은 이 파일 안에서 최소로 흉내 낸다. 흉내 낸 것과
 * 진짜인 것을 아래에 밝힌다.
 *
 * - 진짜(실제 구현 그대로 가져와 씀): `isUniqueViolationError` — `src/lib/db/postgres-errors.ts`.
 *   drizzle/neon이 postgres 오류를 몇 겹 감싸는 방식과 인덱스 이름 대조 규칙을 그대로 시험한다.
 * - 흉내: `FakeUniqueTable` — Postgres의 유일 인덱스를 아주 작은 배열 하나로 흉내 낸 것이다.
 *   실제 유일 인덱스처럼 같은 값이 다시 들어오면 `code: "23505"`와 인덱스 이름을 담은 에러를
 *   던진다(neon/drizzle이 실제로 돌려주는 모양을 옮겼다 — `constraint` 필드 + 인덱스 이름이
 *   포함된 `message`).
 * - 흉내: `saveDocument` — `src/lib/clients-projects/repository.ts`의 `createFounderClient`,
 *   `src/lib/quotes/repository.ts`의 `createFounderQuoteVersion`이 쓰는 것과 **같은 판정
 *   순서**(삽입 시도 → 실패하면 `isUniqueViolationError`로 "이 인덱스가 맞나" 확인 → 맞으면
 *   기존 줄 조회 → 있으면 그 줄을 성공으로 돌려주고, 없거나 다른 인덱스면 오류를 그대로 올림)를
 *   저장소 없이 재현한 것이다. 실제 DB 왕복(네트워크, 트랜잭션)은 흉내 내지 않는다.
 */

const SUBMISSION_INDEX = "fake_documents_submission_idx";

type FakeRow = { id: string; workspaceId: string; name: string; submissionId?: string };

/**
 * Postgres 유일 인덱스 두 개(이름, 제출 식별자)를 흉내 낸 아주 작은 저장소. 실제 DB가 아니다.
 *
 * 실제 저장소 코드(`createFounderClient`)는 이름 쪽 인덱스만 `onConflictDoNothing({ target })`의
 * 조정자로 지정한다. 그래서 이름이 겹치면 조용히 아무 줄도 안 만들고(`undefined` 반환), 조정자로
 * 지정하지 않은 제출 식별자 인덱스가 겹치면 평범한 Postgres 예외가 그대로 올라온다 — 이 순서를
 * 그대로 옮겼다.
 */
class FakeUniqueTable {
  rows: FakeRow[] = [];
  private nextId = 1;

  insert(input: { workspaceId: string; name: string; submissionId?: string }): FakeRow | undefined {
    if (input.submissionId && this.rows.some((row) => row.submissionId === input.submissionId)) {
      throw postgresUniqueViolation(SUBMISSION_INDEX);
    }
    if (this.rows.some((row) => row.workspaceId === input.workspaceId && row.name === input.name)) {
      return undefined; // onConflictDoNothing({ target: name }) — 조용히 아무것도 안 한다.
    }
    const row: FakeRow = { id: `row-${this.nextId++}`, ...input };
    this.rows.push(row);
    return row;
  }

  findBySubmissionId(workspaceId: string, submissionId: string): FakeRow | undefined {
    return this.rows.find((row) => row.workspaceId === workspaceId && row.submissionId === submissionId);
  }
}

/** neon-http가 drizzle 위로 실제 넘기는 모양을 흉내 낸 것 — `cause` 아래 진짜 postgres 에러가 있다. */
function postgresUniqueViolation(indexName: string) {
  return {
    message: `Failed query: insert into "fake_documents"`,
    cause: {
      code: "23505",
      constraint: indexName,
      message: `duplicate key value violates unique constraint "${indexName}"`,
    },
  };
}

/**
 * `createFounderClient`/`createFounderQuoteVersion`과 같은 순서의 판정. 실제 구현은 drizzle
 * insert를 쓰지만, 판정 순서(먼저 넣어 본다 → 제출 식별자 충돌이면 조용히 기존 줄로 대체 → 그 외
 * 충돌은 그대로 올린다)는 이 함수와 동일하다.
 */
function saveDocument(table: FakeUniqueTable, input: { workspaceId: string; name: string; submissionId?: string }) {
  try {
    const row = table.insert(input);
    if (!row) throw new Error("같은 이름의 문서가 이미 있습니다.");
    return { row, duplicate: false };
  } catch (error) {
    if (input.submissionId && isUniqueViolationError(error, SUBMISSION_INDEX)) {
      const existing = table.findBySubmissionId(input.workspaceId, input.submissionId);
      if (existing) return { row: existing, duplicate: true };
    }
    throw error;
  }
}

describe("F02-03 서버 배선 — 저장 계층 흉내", () => {
  it("같은 제출 식별자로 두 번 저장하면 결과가 하나만 생긴다", () => {
    const table = new FakeUniqueTable();
    const submissionId = "11111111-1111-4111-8111-111111111111";

    saveDocument(table, { workspaceId: "ws-1", name: "첫 시도", submissionId });
    saveDocument(table, { workspaceId: "ws-1", name: "첫 시도", submissionId });

    expect(table.rows).toHaveLength(1);
  });

  it("두 번째 시도도 예외 없이(사용자 눈에는 성공으로) 끝나고 같은 줄을 돌려준다", () => {
    const table = new FakeUniqueTable();
    const submissionId = "22222222-2222-4222-8222-222222222222";

    const first = saveDocument(table, { workspaceId: "ws-1", name: "두번째 시나리오", submissionId });
    const second = saveDocument(table, { workspaceId: "ws-1", name: "두번째 시나리오", submissionId });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.row.id).toBe(first.row.id);
  });

  it("식별자가 없으면 두 번 저장하면 두 개가 생긴다 — 막지 않는 것을 막는다고 하지 않는다", () => {
    const table = new FakeUniqueTable();

    saveDocument(table, { workspaceId: "ws-1", name: "이름A" });
    saveDocument(table, { workspaceId: "ws-1", name: "이름B" });

    expect(table.rows).toHaveLength(2);
  });

  it("다른 유일 제약(예: 같은 이름) 위반은 중복 제출로 삼키지 않고 그대로 오류가 된다", () => {
    const table = new FakeUniqueTable();
    saveDocument(table, {
      workspaceId: "ws-1",
      name: "같은 상호",
      submissionId: "33333333-3333-4333-8333-333333333333",
    });

    expect(() =>
      saveDocument(table, {
        workspaceId: "ws-1",
        name: "같은 상호",
        submissionId: "44444444-4444-4444-8444-444444444444",
      }),
    ).toThrow();

    // 삼켜지지 않았으니 줄이 하나만 남아야 한다(두 번째 시도는 저장되지 않았다).
    expect(table.rows).toHaveLength(1);
  });
});

describe("isUniqueViolationError", () => {
  it("코드와 인덱스 이름이 둘 다 맞을 때만 true", () => {
    const error = { code: "23505", constraint: "quotes_submission_idx" };
    expect(isUniqueViolationError(error, "quotes_submission_idx")).toBe(true);
  });

  it("drizzle cause 감싸기를 몇 겹이든 벗겨 본다", () => {
    const error = {
      message: "Failed query: insert into quotes",
      cause: {
        message: "Error connecting to database",
        sourceError: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "client_companies_submission_idx"',
        },
      },
    };
    expect(isUniqueViolationError(error, "client_companies_submission_idx")).toBe(true);
  });

  it("코드는 같아도 다른 인덱스 이름이면 false — 다른 유일 제약을 중복 제출로 삼키지 않는다", () => {
    const error = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "client_companies_workspace_name_idx"',
    };
    expect(isUniqueViolationError(error, "client_companies_submission_idx")).toBe(false);
  });

  it("인덱스 이름이 메시지에 있어도 코드가 23505가 아니면 false", () => {
    const error = { code: "23503", message: 'violates unique constraint "quotes_submission_idx"' };
    expect(isUniqueViolationError(error, "quotes_submission_idx")).toBe(false);
  });

  it("무관한 오류·null은 항상 false", () => {
    expect(isUniqueViolationError(new Error("DATABASE_URL is required"), "quotes_submission_idx")).toBe(false);
    expect(isUniqueViolationError(null, "quotes_submission_idx")).toBe(false);
  });
});

describe("스키마 파일과 마이그레이션이 어긋나지 않는다", () => {
  const schemaSource = readFileSync(join(__dirname, "..", "src/lib/db/schema.ts"), "utf8");
  const migrationSource = readFileSync(join(__dirname, "..", "drizzle/0033_submission_dedupe.sql"), "utf8");

  it("두 표 모두 submission_id 칸을 스키마와 마이그레이션 양쪽에 갖는다", () => {
    expect(schemaSource.match(/submissionId: uuid\("submission_id"\)/g)).toHaveLength(2);
    expect(migrationSource.match(/ADD COLUMN "submission_id" uuid/g)).toHaveLength(2);
  });

  it("고객사 표의 유일 인덱스 이름이 스키마·마이그레이션에서 같다", () => {
    expect(schemaSource).toContain('uniqueIndex("client_companies_submission_idx").on(table.submissionId)');
    expect(migrationSource).toContain('CREATE UNIQUE INDEX "client_companies_submission_idx" ON "client_companies" ("submission_id")');
  });

  it("견적 표의 유일 인덱스 이름이 스키마·마이그레이션에서 같다", () => {
    expect(schemaSource).toContain('uniqueIndex("quotes_submission_idx").on(table.submissionId)');
    expect(migrationSource).toContain('CREATE UNIQUE INDEX "quotes_submission_idx" ON "quotes" ("submission_id")');
  });

  it("실제 저장소 코드가 스키마와 같은 인덱스 이름 문자열을 쓴다(오타로 어긋나지 않게)", () => {
    const clientsRepoSource = readFileSync(join(__dirname, "..", "src/lib/clients-projects/repository.ts"), "utf8");
    const quotesRepoSource = readFileSync(join(__dirname, "..", "src/lib/quotes/repository.ts"), "utf8");
    expect(clientsRepoSource).toContain("client_companies_submission_idx");
    expect(quotesRepoSource).toContain("quotes_submission_idx");
  });
});
