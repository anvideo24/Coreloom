export const ADMIN_MANUAL_OVERVIEW_FILE = "00-coreloom-매뉴얼.md";
export const ADMIN_MANUAL_CHANGELOG_FILE = "CHANGELOG.md";
export const ADMIN_MANUAL_ROLES_DIRECTORY = "roles";

export const ADMIN_MANUAL_PROGRESS_FILE = "system-progress.md";

export const adminManualNav = [
  { href: "/admin/manual", label: "개요" },
  { href: "/admin/manual/progress", label: "시스템 진행 현황" },
  { href: "/admin/manual/roles", label: "역할별 운영 절차" },
  { href: "/admin/manual/changelog", label: "변경 기록" },
] as const;

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
  | { type: "table"; headers: string[]; rows: string[][] };

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
  if (normalized.endsWith(ADMIN_MANUAL_OVERVIEW_FILE)) return "/admin/manual";
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

function listItem(line: string) {
  const unordered = line.match(/^[-*] (.+)$/);
  if (unordered) return { ordered: false, text: unordered[1] };
  const ordered = line.match(/^\d+\. (.+)$/);
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
    while (index < lines.length && lines[index].trim() && !headingLevel(lines[index]) && !listItem(lines[index]) && !lines[index].startsWith("```") && !lines[index].startsWith("> ")) {
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
