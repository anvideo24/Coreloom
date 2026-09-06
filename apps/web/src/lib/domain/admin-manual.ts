export const ADMIN_MANUAL_OVERVIEW_FILE = "00-coreloom-매뉴얼.md";
export const ADMIN_MANUAL_CHANGELOG_FILE = "CHANGELOG.md";
export const ADMIN_MANUAL_ROLES_DIRECTORY = "roles";

export const ADMIN_MANUAL_PROGRESS_FILE = "system-progress.md";

export const ADMIN_MANUAL_HOME_HREF = "/admin/manual";
export const ADMIN_MANUAL_OVERVIEW_HREF = "/admin/manual/overview";

/** 공용 정본 저장소(working-method)에서 읽어 오는 문서. 이 목록에 없는 파일은 읽지 않는다. */
export const SHARED_MANUAL_DOCS = [
  { slug: "rules", file: "RULES.md", title: "공용 규칙" },
  { slug: "how", file: "HOW.md", title: "일하는 방식" },
  { slug: "lessons", file: "LESSONS.md", title: "배운 것" },
] as const;

export function sharedManualDoc(slug: string) {
  const doc = SHARED_MANUAL_DOCS.find((item) => item.slug === slug);
  if (!doc) throw new Error("Unknown manual");
  return doc;
}

export type ManualHomeCard = {
  href: string;
  label: string;
  summary: string;
  source: string;
} & (
  /** shared = 공용 저장소를 읽는 칸. 그 파일이 없으면 「아직 없다」로 표시한다. */
  | { origin: "shared"; slug: string }
  | { origin: "product"; slug?: undefined }
);

export const adminManualHomeSections: { title: string; description: string; cards: ManualHomeCard[] }[] = [
  {
    title: "규칙",
    description: "지켜야 하는 것. 두 규칙이 겹치면 이 제품 규칙이 정본입니다.",
    cards: [
      {
        href: "/admin/manual/shared/rules",
        slug: "rules",
        label: "공용 규칙",
        summary: "돈, 승인, AI 권한, 이력, 비밀. 어느 제품에나 해당합니다.",
        source: "working-method / RULES.md",
        origin: "shared",
      },
      {
        href: "/admin/manual/rules",
        label: "이 제품 규칙",
        summary: "Coreloom만의 차이. 화면 셸, Recho 자료, 관리자 매뉴얼 계약.",
        source: "Coreloom / RULES.md",
        origin: "product",
      },
    ],
  },
  {
    title: "일하는 방식",
    description: "규칙이 아니라 지금 이렇게 하고 있고 이유는 무엇인지를 적습니다.",
    cards: [
      {
        href: "/admin/manual/shared/how",
        slug: "how",
        label: "일하는 방식",
        summary: "일을 받았을 때, 판단할 때, 끝낼 때, 오케이 난 뒤.",
        source: "working-method / HOW.md",
        origin: "shared",
      },
      {
        href: "/admin/manual/shared/lessons",
        slug: "lessons",
        label: "배운 것",
        summary: "같은 실수를 두 번 겪지 않으려고 압축해 둔 기록.",
        source: "working-method / LESSONS.md",
        origin: "shared",
      },
    ],
  },
  {
    title: "운영",
    description: "이 제품을 어떻게 쓰고 지금 어디까지 됐는지.",
    cards: [
      {
        href: "/admin/manual/work-map",
        label: "업무 지도",
        summary: "고객사부터 입금까지. 업무의 역할과 연결을 한눈에 봅니다.",
        source: "Coreloom / manual/work-map.md",
        origin: "product",
      },
      {
        href: "/admin/manual/system-map",
        label: "시스템 구조도",
        summary: "회사 기록·파일·AI·외부 연결·문서의 관계와 경계를 봅니다.",
        source: "Coreloom / manual/system-map.md",
        origin: "product",
      },
      {
        href: ADMIN_MANUAL_OVERVIEW_HREF,
        label: "운영 설명",
        summary: "시스템 구조와 운영 방법 전문. 길어서 여기서만 폅니다.",
        source: "Coreloom / manual/00-coreloom-매뉴얼.md",
        origin: "product",
      },
      {
        href: "/admin/manual/progress",
        label: "시스템 진행 현황",
        summary: "구현 현황 표와 기능별 개선 목표·검증 현황.",
        source: "Coreloom / manual/system-progress.md",
        origin: "product",
      },
      {
        href: "/admin/manual/roles",
        label: "역할별 운영 절차",
        summary: "대표, 팀원, 회계 담당자가 각각 무엇을 하는지.",
        source: "Coreloom / manual/roles/",
        origin: "product",
      },
      {
        href: "/admin/manual/changelog",
        label: "변경 기록",
        summary: "매뉴얼이 언제 무엇 때문에 바뀌었는지.",
        source: "Coreloom / manual/CHANGELOG.md",
        origin: "product",
      },
    ],
  },
];

export type ManualInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string | null };

export type ManualBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; inlines: ManualInline[] }
  | { type: "list"; ordered: boolean; items: ManualInline[][] }
  | { type: "code"; text: string }
  | { type: "quote"; inlines: ManualInline[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  /** `:::history`로 명시한 과거 구현 메모. 현재 상태·경고와 섞이지 않게 접는다. */
  | { type: "historical"; blocks: ManualBlock[] };

export function isSafeManualSlug(slug: string) {
  return slug.trim() === slug && slug.length > 0 && slug.length <= 80 && !/[./\\]/.test(slug);
}

export function assertManualRelativePath(relativePath: string) {
  const value = relativePath.trim();
  if (!value.endsWith(".md")) throw new Error("Manual path is not allowed");
  if (value !== value.replaceAll("\\", "/")) throw new Error("Manual path is not allowed");
  if (value.startsWith("/") || value.includes("..") || value.includes("\0")) throw new Error("Manual path is not allowed");
  const parts = value.split("/");
  if (parts.some((part) => !part || part === "." || part.startsWith("."))) throw new Error("Manual path is not allowed");
  return value;
}

export function roleManualFile(slug: string) {
  if (!isSafeManualSlug(slug)) throw new Error("Unknown manual");
  return assertManualRelativePath(`${ADMIN_MANUAL_ROLES_DIRECTORY}/${slug}.md`);
}

export function listRoleManuals(filenames: string[]) {
  return filenames
    .filter((name) => name.endsWith(".md") && !name.startsWith("."))
    .flatMap((name) => {
      const slug = name.slice(0, -3);
      if (!isSafeManualSlug(slug)) return [];
      return [{
        slug,
        title: slug,
        href: `/admin/manual/roles/${encodeURIComponent(slug)}`,
        file: roleManualFile(slug),
      }];
    })
    .sort((left, right) => left.slug.localeCompare(right.slug, "ko"));
}

export function resolveManualHref(href: string) {
  const trimmed = href.trim();
  if (/^https:\/\//i.test(trimmed) || /^http:\/\//i.test(trimmed)) return trimmed;
  const normalized = trimmed.replaceAll("\\", "/").replace(/^\.\//, "");
  if (normalized === "work-map.md" || normalized === "manual/work-map.md") return "/admin/manual/work-map";
  if (normalized === "system-map.md" || normalized === "manual/system-map.md") return "/admin/manual/system-map";
  if (normalized.endsWith(ADMIN_MANUAL_OVERVIEW_FILE)) return ADMIN_MANUAL_OVERVIEW_HREF;
  if (normalized.endsWith(ADMIN_MANUAL_CHANGELOG_FILE)) return "/admin/manual/changelog";
  if (normalized.endsWith(ADMIN_MANUAL_PROGRESS_FILE)) return "/admin/manual/progress";
  const roleMatch = normalized.match(/(?:^|\/)roles\/([^/]+)\.md$/);
  if (roleMatch && isSafeManualSlug(roleMatch[1])) return `/admin/manual/roles/${encodeURIComponent(roleMatch[1])}`;
  return null;
}

export function shortenCommit(value: string) {
  const commit = value.trim();
  if (!commit) return "없음";
  return commit.length > 12 ? commit.slice(0, 12) : commit;
}

export function parseManualInlines(text: string): ManualInline[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/);
  return tokens.filter(Boolean).map((token) => {
    if (token.startsWith("**") && token.endsWith("**")) return { type: "strong" as const, text: token.slice(2, -2) };
    if (token.startsWith("`") && token.endsWith("`")) return { type: "code" as const, text: token.slice(1, -1) };
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return { type: "link" as const, text: link[1], href: resolveManualHref(link[2]) };
    return { type: "text" as const, text: token };
  });
}

function headingLevel(line: string): 1 | 2 | 3 | null {
  if (line.startsWith("### ")) return 3;
  if (line.startsWith("## ")) return 2;
  if (line.startsWith("# ")) return 1;
  return null;
}

/**
 * 들여 쓴 목록도 목록으로 읽는다. 들여쓰기를 안 받아 주면 하위 항목이 목록에서 떨어져 나와
 * 앞 문단에 통째로 붙어 한 줄로 뭉친다 — 에러 없이 화면에서만 어긋난다.
 * 계층은 만들지 않고 같은 높이의 목록으로 편다.
 */
function listItem(line: string) {
  const body = line.replace(/^[ \t]+/, "");
  const unordered = body.match(/^[-*] (.+)$/);
  if (unordered) return { ordered: false, text: unordered[1] };
  const ordered = body.match(/^\d+\. (.+)$/);
  if (ordered) return { ordered: true, text: ordered[1] };
  return null;
}

export function parseManualMarkdown(markdown: string): ManualBlock[] {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks: ManualBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim() === ":::history") {
      const start = index + 1;
      let end = start;
      while (end < lines.length && lines[end].trim() !== ":::") end += 1;
      if (end < lines.length) {
        blocks.push({ type: "historical", blocks: parseManualMarkdown(lines.slice(start, end).join("\n")) });
        index = end + 1;
        continue;
      }
    }

    if (line.startsWith("| ") && line.includes(" | ")) {
      const parseRow = (raw: string) => raw.split("|").map((cell) => cell.trim()).filter(Boolean);
      const headers = parseRow(line);
      index += 1;
      if (index < lines.length && /^\|[\s:|-]+\|$/.test(lines[index].trim())) index += 1;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].startsWith("| ")) {
        rows.push(parseRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (line.startsWith("```")) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        body.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    const heading = headingLevel(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading, text: line.slice(heading + 1) });
      index += 1;
      continue;
    }

    const item = listItem(line);
    if (item) {
      const items = [parseManualInlines(item.text)];
      const ordered = item.ordered;
      index += 1;
      while (index < lines.length) {
        const next = listItem(lines[index]);
        if (!next || next.ordered !== ordered) break;
        items.push(parseManualInlines(next.text));
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (line.startsWith("> ")) {
      const quoted: string[] = [line.slice(2)];
      index += 1;
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoted.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ type: "quote", inlines: parseManualInlines(quoted.join(" ")) });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && lines[index].trim() !== ":::history" && lines[index].trim() !== ":::" && !headingLevel(lines[index]) && !listItem(lines[index]) && !lines[index].startsWith("```") && !lines[index].startsWith("> ")) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: "paragraph", inlines: parseManualInlines(paragraph.join(" ")) });
  }

  return blocks;
}

export function buildAdminManualPage(input: {
  title: string;
  markdown: string;
  deployVersion: string;
  deployCommit: string;
  manualCommit: string;
}) {
  return {
    title: input.title,
    readOnly: true as const,
    deployVersion: input.deployVersion.trim() || "없음",
    deployCommit: shortenCommit(input.deployCommit),
    manualCommit: shortenCommit(input.manualCommit),
    blocks: parseManualMarkdown(input.markdown),
  };
}
