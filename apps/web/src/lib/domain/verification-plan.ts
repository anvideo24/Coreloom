/**
 * 개선 목표·검증 현황 — 어휘와 판정 규칙의 단일 자리.
 *
 * 원본은 둘이다. 둘 다 git 파일이고 화면은 읽기만 한다.
 *  - 계획: `docs/superpowers/plans/2026-09-05-measurable-improvements.md` (F01–F07, 검사 28개)
 *  - 결과: `docs/quality/verification-results.json` (덧붙이기만 한다. 지우지 않는다)
 *
 * 계획서의 「현재 판정」 칸은 **계획 작성·개정 당시의 판정**이다. 현재 상태로 쓰지 않는다.
 * 현재 상태는 결과 파일에서만 온다. 그래야 상태 사본이 두 벌이 안 된다.
 *
 * 이 파일은 순수하다. 파일·git·네트워크를 만지지 않는다. 그건 `@/lib/admin-manual/verification`이 한다.
 */

import { z } from "zod";

import { parseManualMarkdown, type ManualBlock } from "@/lib/domain/admin-manual";

export const VERIFICATION_PLAN_FILE = "docs/superpowers/plans/2026-09-05-measurable-improvements.md";
export const VERIFICATION_RESULTS_FILE = "docs/quality/verification-results.json";
export const VERIFICATION_HREF = "/admin/manual/progress";

/** 기능 ID는 `F01`, 검사 ID는 `F01-01` 꼴만 받는다. */
export const FEATURE_ID_PATTERN = /^F\d{2}$/;
export const CHECK_ID_PATTERN = /^F\d{2}-\d{2}$/;

/** 결과 파일에 적는 결과. `needs-recheck`는 사람이 적는 값이 아니라 계산으로만 나온다. */
export type RecordedOutcome = "pass" | "fail" | "unverified" | "excluded";
export type EffectiveOutcome = RecordedOutcome | "needs-recheck" | "no-result";
export type EvidenceKind = "automated" | "human";

export type PlanCheck = {
  id: string;
  featureId: string;
  /** 목표·통과 기준 칸 원문 */
  target: string;
  /** 검증 방법 칸 원문 */
  method: string;
  /** 계획서 「현재 판정」 칸 원문. 계획 당시 값이며 현재 상태가 아니다. */
  planVerdict: string;
  /**
   * 목표·방법 칸이 **셀 수 있는 수**를 요구하면 그 수(`16/16 시나리오`→16, `5사례`→5, `3/3`→3).
   * 없으면 null. 이게 있으면 결과에 `measured`를 요구하고, 덜 쟀으면 통과로 안 센다.
   *
   * 왜 있나 — 2026-09-05에 「16/16 시나리오」가 목표인 검사가 **1개만 재고 통과**로 들어왔다.
   * 결과 줄 스스로 「나머지 15개는 미측정」이라 적어 두고도 초록불이 켜졌다. 사람이 값을 읽어야만
   * 드러나는 자리였다. 셀 수 있는 것은 코드가 센다.
   */
  requiredCount: number | null;
  /** 계획의 「필수 검증 환경」 목록. 빈 목록은 조건 미정이며 통과할 수 없다. */
  requiredEnvironments: string[];
};

export type PlanFeature = {
  id: string;
  /** `## F05 · 대시보드 숫자·프로젝트 정확성`에서 `·` 뒤 */
  name: string;
  /** `목표:` 문단. 없으면 빈 문자열 */
  goal: string;
  /** `범위:` 문단. 없으면 null */
  scope: string | null;
  /** `기준:` 문단. 없으면 null */
  baseline: string | null;
  /**
   * `후속 구현 대상:` 문단에서 뽑은 파일 경로 조각. 관련 변경 판정에 쓴다.
   * 확장자(.ts .tsx .css .md)가 붙은 토큰만 경로로 센다. 「공통 프레임·토큰」 같은 말은 경로가 아니다.
   */
  paths: string[];
  checks: PlanCheck[];
  /** 이 기능 절의 원문을 블록으로. 상세 화면이 그대로 렌더한다. */
  blocks: ManualBlock[];
};

export type VerificationPlan = {
  /** `계획 버전: N` */
  version: number;
  /** `작성일: YYYY-MM-DD` */
  date: string;
  features: PlanFeature[];
};

export type CheckResult = {
  checkId: string;
  outcome: RecordedOutcome;
  /** 실측값 또는 사유. 비우지 않는다 */
  value: string;
  evidence: {
    kind: EvidenceKind;
    /** 시험 파일·문서 경로·앵커 등 다시 찾아갈 수 있는 자리 */
    ref: string;
    /** ISO 8601. 날짜만 있으면 `YYYY-MM-DD`도 허용하되 시각 미상으로 본다 */
    checkedAt: string;
    /** 사람 확인이면 누가. 자동이면 생략 가능 */
    by?: string;
  };
  /** 검증 대상 코드 커밋(40자 SHA). 결과 파일을 저장한 커밋이 아니다 */
  codeCommit: string;
  /** 검증 당시 계획 버전 */
  planVersion: number;
  /** 기기·브라우저·뷰포트 또는 「도메인 함수 직접 실행」 */
  environment: string;
  /** 실제 증거가 포괄한 환경명. 옛 기록은 생략 가능하지만 통과로 세지 않는다. */
  environments?: string[];
  /**
   * 목표가 셀 수 있는 수를 요구할 때, **몇 개를 실제로 쟀나**. `total`은 목표의 수와 같아야 한다.
   * 덜 쟀으면 그 사실이 화면에 그대로 남고 통과로 세지 않는다.
   */
  measured?: { covered: number; total: number };
  note?: string;
};

export type ImplementationStage = "not-started" | "in-progress" | "on-main" | "in-use";

export type FeatureImplementation = {
  featureId: string;
  stage: ImplementationStage;
  /** 가지·PR·커밋 등 */
  ref?: string;
  recordedAt: string;
  note?: string;
};

export type VerificationResultsFile = {
  schemaVersion: 1;
  implementation: FeatureImplementation[];
  results: CheckResult[];
};

export type CheckStatus = {
  check: PlanCheck;
  /** checkedAt 기준 가장 최근 기록. 없으면 null */
  latest: CheckResult | null;
  /** 판정 규칙을 거친 뒤의 상태 */
  effective: EffectiveOutcome;
  /** 통과로 안 세는 이유. 통과이거나 결과 없음이면 null */
  reason: string | null;
  /** 전부, 최신이 먼저 */
  history: CheckResult[];
};

export type FeatureCounts = {
  /** 제외(excluded)를 뺀 검사 수 = 분모 */
  required: number;
  pass: number;
  fail: number;
  recheck: number;
  unverified: number;
  excluded: number;
  none: number;
};

export type FeatureStatus = {
  feature: PlanFeature;
  implementation: FeatureImplementation | null;
  checks: CheckStatus[];
  counts: FeatureCounts;
  /** 사람 말로 된 다음 행동 한 줄 */
  nextAction: string;
  /** 필수 전부 통과 + 사용 환경 반영(in-use)일 때만 true */
  complete: boolean;
};

export type BuildVerificationStatusInput = {
  plan: VerificationPlan;
  file: VerificationResultsFile;
  /**
   * 그 커밋 이후 바뀐 파일 목록(저장소 뿌리 기준 상대 경로). 커밋을 모르면 null.
   * null이면 보수적으로 재검증 필요로 본다.
   */
  changedPathsSince: (codeCommit: string) => string[] | null;
};

/* ------------------------------------------------------------------ */
/* 아래는 구현을 돕는 내부 helper. export 하지 않는다.                   */
/* ------------------------------------------------------------------ */

/** `## F05 · 이름` 꼴의 절 제목만 인식한다. `·` 없는 다른 절 제목은 기능이 아니다. */
const FEATURE_HEADING_PATTERN = /^##\s+(\S+)\s*·\s*(.+)$/;

/**
 * 확장자가 붙은 경로 조각만 뽑는다. 괄호(라우트 그룹 `(private)`)·대괄호(동적 구간 `[featureId]`)·
 * 마침표 다중 확장자(`.test.ts`)를 허용한다. 대괄호를 빼면 `progress/[featureId]/page.tsx`가
 * `/page.tsx`로 잘려 어떤 변경에도 안 걸린다 — 에러 없이 재검증이 영원히 안 뜨는 자리다.
 */
const PATH_TOKEN_PATTERN = /[A-Za-z0-9_./()[\]-]+\.(?:ts|tsx|css|md)\b/g;

/** `YYYY-MM-DD` 또는 그 뒤에 시각이 붙은 ISO 8601. */
const CHECKED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;

/** 40자 hex 커밋 해시. */
const COMMIT_HASH_PATTERN = /^[0-9a-f]{40}$/i;

/**
 * 목표·방법 칸에서 **셀 수 있는 수**를 뽑는다. `16/16 시나리오`·`6/6 상태 분류`·`3/3`처럼 같은 수를
 * 두 번 쓴 꼴, 그리고 `5사례`처럼 사례 수를 센 꼴만 인정한다. `0건`·`100%`·`30% 이상`은 개수가 아니다.
 * 못 찾으면 null이고, 그때는 개수 관문이 안 걸린다(없는 수를 지어내지 않는다).
 */
function extractRequiredCount(target: string, method: string): number | null {
  for (const text of [target, method]) {
    const ratio = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (ratio && ratio[1] === ratio[2]) return Number(ratio[1]);
    const cases = text.match(/(\d+)\s*사례/);
    if (cases) return Number(cases[1]);
  }
  return null;
}

/** 통과라고 적으면서 본문에 「아직 안 쟀다」를 함께 적은 줄을 잡는다. */
const SELF_ADMITTED_GAP = /미측정|측정\s*전|측정하지\s*않|아직\s*(?:이다|입니다|안\s|측정)/;

function blockText(block: ManualBlock): string | null {
  if (block.type !== "paragraph") return null;
  return block.inlines.map((inline) => inline.text).join("");
}

function extractFollowUpPaths(text: string): string[] {
  return [...text.matchAll(PATH_TOKEN_PATTERN)].map((match) => match[0]);
}

function toTimestamp(checkedAt: string): number {
  const value = /^\d{4}-\d{2}-\d{2}$/.test(checkedAt) ? `${checkedAt}T00:00:00.000Z` : checkedAt;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) throw new Error(`checkedAt을 해석할 수 없습니다: ${checkedAt}`);
  return time;
}

function normalizeSlashes(value: string): string {
  return value.trim().replaceAll("\\", "/");
}

/** feature.paths 중 changedPaths의 어느 하나든 「경로 끝이 일치」하면 그 바뀐 경로를 반환한다. */
function findMatchingChangedPath(paths: string[], changedPaths: string[]): string | null {
  for (const rawChanged of changedPaths) {
    const changed = normalizeSlashes(rawChanged);
    for (const rawFeaturePath of paths) {
      const featurePath = normalizeSlashes(rawFeaturePath);
      if (!featurePath) continue;
      if (changed === featurePath || changed.endsWith(`/${featurePath}`)) return rawChanged;
    }
  }
  return null;
}

const checkResultSchema = z
  .object({
    checkId: z.string().regex(CHECK_ID_PATTERN, "checkId 형식이 F00-00이 아닙니다."),
    outcome: z.enum(["pass", "fail", "unverified", "excluded"]),
    value: z.string(),
    evidence: z
      .object({
        kind: z.enum(["automated", "human"]),
        ref: z.string(),
        checkedAt: z.string().regex(CHECKED_AT_PATTERN, "checkedAt은 YYYY-MM-DD 또는 ISO 날짜(시각)여야 합니다."),
        by: z.string().optional(),
      })
      .strict(),
    codeCommit: z.string().regex(COMMIT_HASH_PATTERN, "codeCommit은 40자 hex여야 합니다."),
    planVersion: z.number().int(),
    environment: z.string(),
    environments: z.array(z.string().trim().min(1)).optional(),
    measured: z
      .object({ covered: z.number().int().min(0), total: z.number().int().min(1) })
      .strict()
      .optional(),
    note: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.outcome === "pass") {
      if (!value.value.trim()) ctx.addIssue({ code: "custom", message: `${value.checkId}: pass인데 value가 비어 있습니다.`, path: ["value"] });
      if (!value.evidence.ref.trim()) ctx.addIssue({ code: "custom", message: `${value.checkId}: pass인데 evidence.ref가 비어 있습니다.`, path: ["evidence", "ref"] });
      if (!value.environment.trim()) ctx.addIssue({ code: "custom", message: `${value.checkId}: pass인데 environment가 비어 있습니다.`, path: ["environment"] });
    }
    if (value.outcome === "pass" && value.measured && value.measured.covered > value.measured.total) {
      ctx.addIssue({ code: "custom", message: `${value.checkId}: measured.covered가 total보다 큽니다.`, path: ["measured"] });
    }
    if (value.outcome === "excluded" && !value.note?.trim()) {
      ctx.addIssue({ code: "custom", message: `${value.checkId}: excluded인데 note(제외 사유)가 없습니다.`, path: ["note"] });
    }
  });

const implementationSchema = z
  .object({
    featureId: z.string().regex(FEATURE_ID_PATTERN, "featureId 형식이 F00이 아닙니다."),
    stage: z.enum(["not-started", "in-progress", "on-main", "in-use"]),
    ref: z.string().optional(),
    recordedAt: z.string(),
    note: z.string().optional(),
  })
  .strict();

const verificationResultsFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    implementation: z.array(implementationSchema),
    results: z.array(checkResultSchema),
  })
  .strict();

/* ------------------------------------------------------------------ */
/* 아래 함수는 ㉠ 작업자가 구현한다. 서명은 바꾸지 않는다.               */
/* ------------------------------------------------------------------ */

/**
 * 계획서 마크다운 → 구조. 규칙:
 *  - `계획 버전: N`, `작성일: YYYY-MM-DD`를 머리에서 읽는다.
 *  - `## F0N · 이름` 제목부터 다음 `## `까지가 한 기능이다. FEATURE_ID_PATTERN에 안 맞는 절은 기능이 아니다.
 *  - 그 절 안의 표에서 ID 칸이 CHECK_ID_PATTERN에 맞는 행이 검사다. 앞 열 순서는 `완료 | ID | 목표·통과 기준 | 검증 방법 | 현재 판정`.
 *  - 「필수 검증 환경」 열은 쉼표로 구분한 정확한 환경명이다. 없는 과거 계획도 읽지만 통과 판정은 막는다.
 *  - 검사 ID가 겹치면 throw. 기능 ID가 겹쳐도 throw.
 *  - 기능 절의 블록은 `parseManualMarkdown`으로 만든다(제목 포함).
 */
export function parseVerificationPlan(markdown: string): VerificationPlan {
  const normalized = markdown.replaceAll("\r\n", "\n");

  const versionMatch = normalized.match(/계획\s*버전:\s*(\d+)/);
  if (!versionMatch) throw new Error("계획 버전을 찾지 못했습니다.");
  const version = Number(versionMatch[1]);

  const dateMatch = normalized.match(/작성일:\s*(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) throw new Error("작성일을 찾지 못했습니다.");
  const date = dateMatch[1];

  const lines = normalized.split("\n");
  const headingIndexes: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) headingIndexes.push(i);
  }

  const seenFeatureIds = new Set<string>();
  const seenCheckIds = new Set<string>();
  const features: PlanFeature[] = [];

  for (let h = 0; h < headingIndexes.length; h += 1) {
    const start = headingIndexes[h];
    const end = h + 1 < headingIndexes.length ? headingIndexes[h + 1] : lines.length;
    const headingLine = lines[start];

    const headingMatch = headingLine.match(FEATURE_HEADING_PATTERN);
    if (!headingMatch) continue;
    const [, id, name] = headingMatch;
    if (!FEATURE_ID_PATTERN.test(id)) continue;

    if (seenFeatureIds.has(id)) throw new Error(`기능 ID가 중복됩니다: ${id}`);
    seenFeatureIds.add(id);

    const sectionMarkdown = lines.slice(start, end).join("\n");
    const blocks = parseManualMarkdown(sectionMarkdown);

    let goal = "";
    let scope: string | null = null;
    let baseline: string | null = null;
    let paths: string[] = [];
    const checks: PlanCheck[] = [];

    for (const block of blocks) {
      if (block.type === "table") {
        const environmentIndex = block.headers.findIndex((header) => header.trim() === "필수 검증 환경");
        for (const row of block.rows) {
          const idIndex = row.findIndex((cell) => CHECK_ID_PATTERN.test(cell.trim()));
          if (idIndex === -1) continue;
          const checkId = row[idIndex].trim();
          if (seenCheckIds.has(checkId)) throw new Error(`검사 ID가 중복됩니다: ${checkId}`);
          seenCheckIds.add(checkId);
          const target = (row[idIndex + 1] ?? "").trim();
          const method = (row[idIndex + 2] ?? "").trim();
          checks.push({
            id: checkId,
            featureId: id,
            target,
            method,
            planVerdict: (row[idIndex + 3] ?? "").trim(),
            requiredCount: extractRequiredCount(target, method),
            requiredEnvironments: environmentIndex < 0 ? [] : (row[environmentIndex] ?? "").split(",").map((value) => value.trim()).filter(Boolean),
          });
        }
        continue;
      }

      const text = blockText(block);
      if (text === null) continue;

      const goalMatch = text.match(/^목표:\s*(.*)$/);
      if (goalMatch) { goal = goalMatch[1].trim(); continue; }

      const scopeMatch = text.match(/^범위:\s*(.*)$/);
      if (scopeMatch) { scope = scopeMatch[1].trim(); continue; }

      const baselineMatch = text.match(/^기준:\s*(.*)$/);
      if (baselineMatch) { baseline = baselineMatch[1].trim(); continue; }

      const followUpMatch = text.match(/^후속\s*구현\s*대상:\s*(.*)$/);
      if (followUpMatch) { paths = extractFollowUpPaths(followUpMatch[1]); continue; }
    }

    features.push({ id, name: name.trim(), goal, scope, baseline, paths, checks, blocks });
  }

  return { version, date, features };
}

/**
 * 결과 파일 JSON → 구조. zod로 검증한다. 어긋나면 throw(어느 자리가 왜 틀렸는지 메시지에 담는다).
 *  - checkId는 CHECK_ID_PATTERN. codeCommit은 40자 hex. checkedAt은 날짜 또는 날짜+시각 ISO.
 *  - outcome이 `pass`면 value·evidence.ref·environment가 비어 있으면 안 된다(빈칸 통과 금지는 여기서 막는다).
 *  - outcome이 `excluded`면 note가 있어야 한다(제외 사유).
 */
export function parseVerificationResults(json: string): VerificationResultsFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    throw new Error(`검증 결과 JSON을 읽을 수 없습니다: ${(error as Error).message}`);
  }

  const parsed = verificationResultsFileSchema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
    throw new Error(`검증 결과 형식이 올바르지 않습니다 — ${detail}`);
  }
  return parsed.data;
}

/**
 * 계획 + 결과 → 기능별 현황. 규칙(F07-03·F07-04의 정본):
 *  1. 검사마다 checkedAt이 가장 늦은 기록이 latest다. 같은 시각이면 파일에서 뒤에 적힌 것.
 *  2. latest가 없으면 `no-result`.
 *  3. latest.outcome이 `pass`여도 다음 하나라도 걸리면 통과가 아니다(`unverified` + reason):
 *     - planVersion !== plan.version → 「다른 계획 버전」
 *     - evidence.ref·environment·codeCommit·value 중 빈 것 → 「증거 없음」/「환경 없음」 등
 *     - 필수 검증 환경이 없거나 environments가 이를 모두 포함하지 않음 → 미검증. 자유서술 environment로 추정하지 않음
 *     - check.requiredCount가 있는데 measured가 없음 → 「잰 개수 없음(목표 N개)」
 *     - measured.total !== requiredCount → 「목표 개수와 다름」
 *     - measured.covered < measured.total → 「범위 미달 covered/total」
 *  4. 3을 통과한 pass에 대해 changedPathsSince(codeCommit)가
 *     - null이면 → `needs-recheck`(「검증 코드 버전을 찾지 못함」)
 *     - feature.paths 중 하나라도 바뀐 경로에 걸리면(경로 끝이 일치) → `needs-recheck`(「관련 파일 변경: …」)
 *  5. fail·unverified·excluded는 그대로.
 *  6. 계획에 없는 checkId 결과는 무시하지 않고 throw(명단에서 빠진 것을 조용히 못 보게).
 *  7. counts.required = excluded가 아닌 검사 수. pass는 effective==='pass'만 센다.
 *  8. nextAction 우선순위: 결과 없음 → 실패 → 재검증 → 미검증 → 사용 환경 반영 확인 → 「완료」.
 *  9. complete = required 전부 pass && implementation?.stage === 'in-use'.
 * 기능 순서는 계획서 순서. 결과에만 있는 기능은 6번으로 throw.
 */
export function buildVerificationStatus(input: BuildVerificationStatusInput): FeatureStatus[] {
  const { plan, file, changedPathsSince } = input;

  const featureIds = new Set(plan.features.map((feature) => feature.id));
  const checkById = new Map<string, PlanCheck>();
  for (const feature of plan.features) {
    for (const check of feature.checks) checkById.set(check.id, check);
  }

  for (const implementation of file.implementation) {
    if (!featureIds.has(implementation.featureId)) {
      throw new Error(`계획에 없는 기능의 구현 기록입니다: ${implementation.featureId}`);
    }
  }

  const resultsByCheck = new Map<string, (CheckResult & { index: number })[]>();
  file.results.forEach((result, index) => {
    if (!checkById.has(result.checkId)) {
      throw new Error(`계획에 없는 검사 결과입니다: ${result.checkId}`);
    }
    const list = resultsByCheck.get(result.checkId) ?? [];
    list.push({ ...result, index });
    resultsByCheck.set(result.checkId, list);
  });

  const implementationByFeature = new Map(file.implementation.map((item) => [item.featureId, item] as const));

  return plan.features.map((feature) => {
    const checks: CheckStatus[] = feature.checks.map((check) => {
      const records = resultsByCheck.get(check.id) ?? [];
      const ordered = [...records].sort((a, b) => {
        const diff = toTimestamp(b.evidence.checkedAt) - toTimestamp(a.evidence.checkedAt);
        return diff !== 0 ? diff : b.index - a.index;
      });
      const history: CheckResult[] = ordered.map(({ index: _index, ...rest }) => rest);
      const latest = history[0] ?? null;

      let effective: EffectiveOutcome;
      let reason: string | null = null;

      if (!latest) {
        effective = "no-result";
      } else if (latest.outcome !== "pass") {
        effective = latest.outcome;
      } else {
        const problems: string[] = [];
        if (latest.planVersion !== plan.version) problems.push("다른 계획 버전");
        if (!latest.evidence.ref.trim()) problems.push("증거 없음");
        if (!latest.environment.trim()) problems.push("환경 없음");
        if (check.requiredEnvironments.length === 0) {
          problems.push("계획의 필수 검증 환경 없음");
        } else {
          const missing = check.requiredEnvironments.filter((environment) => !latest.environments?.includes(environment));
          if (missing.length > 0) problems.push(`검증 환경 미달: ${missing.join(" · ")}`);
        }
        if (!latest.codeCommit.trim()) problems.push("커밋 없음");
        if (!latest.value.trim()) problems.push("실측값 없음");
        // 스스로 「아직 안 쟀다」고 적어 두고 통과 딱지를 붙인 줄이 실제로 들어왔다(2026-09-05).
        // 파일 파싱에서 막으면 그 과거 기록 자체를 못 읽어 이력이 사라진다. 그래서 판정에서 막는다.
        const admitted = SELF_ADMITTED_GAP.exec(`${latest.value} ${latest.note ?? ""}`);
        if (admitted) problems.push(`스스로 적은 미측정: 「${admitted[0]}」`);
        // 셀 수 있는 목표는 코드가 센다. 문장으로 타이르면 이번처럼 조용히 통과한다.
        if (check.requiredCount !== null) {
          const measured = latest.measured;
          if (!measured) problems.push(`잰 개수 없음(목표 ${check.requiredCount}개)`);
          else if (measured.total !== check.requiredCount) problems.push(`목표 개수와 다름(${measured.total} vs ${check.requiredCount})`);
          else if (measured.covered < measured.total) problems.push(`범위 미달 ${measured.covered}/${measured.total}`);
        }

        if (problems.length > 0) {
          effective = "unverified";
          reason = problems.join(", ");
        } else {
          const changedPaths = changedPathsSince(latest.codeCommit);
          if (changedPaths === null) {
            effective = "needs-recheck";
            reason = "검증 코드 버전을 찾지 못함";
          } else {
            const matched = findMatchingChangedPath(feature.paths, changedPaths);
            if (matched) {
              effective = "needs-recheck";
              reason = `관련 파일 변경: ${matched}`;
            } else {
              effective = "pass";
            }
          }
        }
      }

      return { check, latest, effective, reason, history };
    });

    const counts: FeatureCounts = {
      required: checks.filter((status) => status.effective !== "excluded").length,
      pass: checks.filter((status) => status.effective === "pass").length,
      fail: checks.filter((status) => status.effective === "fail").length,
      recheck: checks.filter((status) => status.effective === "needs-recheck").length,
      unverified: checks.filter((status) => status.effective === "unverified").length,
      excluded: checks.filter((status) => status.effective === "excluded").length,
      none: checks.filter((status) => status.effective === "no-result").length,
    };

    const implementation = implementationByFeature.get(feature.id) ?? null;

    let nextAction: string;
    if (counts.none > 0) nextAction = `결과 없음 ${counts.none}건 측정`;
    else if (counts.fail > 0) nextAction = `실패 ${counts.fail}건 수정`;
    else if (counts.recheck > 0) nextAction = `재검증 ${counts.recheck}건`;
    else if (counts.unverified > 0) nextAction = `미검증 ${counts.unverified}건 증거 보강`;
    else if (implementation?.stage !== "in-use") nextAction = "사용 환경 반영 확인";
    else nextAction = "완료";

    // 전부 제외돼 분모가 0이면 「다 통과」가 아니라 「잴 것이 없다」다. 완료로 세지 않는다.
    const complete = counts.required > 0 && counts.pass === counts.required && implementation?.stage === "in-use";

    return { feature, implementation, checks, counts, nextAction, complete };
  });
}

/** 화면 딱지용 한글. 상태값을 화면에서 직접 번역하지 않는다 — 여기 한 곳. */
export function outcomeLabel(outcome: EffectiveOutcome): string {
  switch (outcome) {
    case "pass": return "통과";
    case "fail": return "실패";
    case "unverified": return "미검증";
    case "needs-recheck": return "재검증 필요";
    case "excluded": return "제외";
    case "no-result": return "결과 없음";
  }
}

export function stageLabel(stage: ImplementationStage | null): string {
  switch (stage) {
    case "in-progress": return "구현 중";
    case "on-main": return "main 반영";
    case "in-use": return "사용 환경 반영";
    case "not-started":
    case null:
    default: return "미착수";
  }
}
