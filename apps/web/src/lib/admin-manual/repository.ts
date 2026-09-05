import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

import "server-only";

import {
  ADMIN_MANUAL_CHANGELOG_FILE,
  ADMIN_MANUAL_OVERVIEW_FILE,
  ADMIN_MANUAL_PROGRESS_FILE,
  ADMIN_MANUAL_ROLES_DIRECTORY,
  assertManualRelativePath,
  listRoleManuals,
  roleManualFile,
  SHARED_MANUAL_DOCS,
  sharedManualDoc,
} from "@/lib/domain/admin-manual";

/** 공용 정본 저장소는 이 제품 저장소와 같은 부모 폴더에 클론한다. */
const SHARED_MANUAL_DIRECTORY_NAME = "working-method";

export function gitOutput(args: string[], cwd: string) {
  try {
    return execFileSync("git", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/**
 * 저장소 뿌리는 프로세스가 사는 동안 안 바뀐다. 매뉴얼 화면은 `force-dynamic`이라
 * 기억해 두지 않으면 화면 한 번에 git을 대여섯 번 새로 띄운다.
 */
let cachedGitRoot: string | null | undefined;

export function gitRoot() {
  if (cachedGitRoot === undefined) {
    cachedGitRoot = gitOutput(["rev-parse", "--show-toplevel"], process.cwd()) || null;
  }
  return cachedGitRoot;
}

function findManualDirectory() {
  const candidates: string[] = [];
  const root = gitRoot();
  if (root) candidates.push(resolve(root, "manual"));
  candidates.push(resolve(process.cwd(), "../../manual"), resolve(process.cwd(), "manual"));
  return candidates.find((directory) => existsSync(directory)) ?? null;
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { version?: string };
    return pkg.version?.trim() || "";
  } catch {
    return "";
  }
}

export function readAdminManualSource() {
  const directory = findManualDirectory();
  if (!directory) throw new Error("Manual source was not found");
  const root = gitRoot() || resolve(directory, "..");
  const deployCommit = gitOutput(["rev-parse", "HEAD"], root) || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "";
  const manualCommit = gitOutput(["log", "-1", "--format=%H", "--", "manual"], root) || deployCommit;
  return {
    directory,
    deployVersion: process.env.CORELOOM_DEPLOY_VERSION?.trim() || readPackageVersion() || "0.1.0",
    deployCommit,
    manualCommit,
  };
}

function readManualFile(relativePath: string) {
  const source = readAdminManualSource();
  const safePath = assertManualRelativePath(relativePath);
  const fullPath = resolve(source.directory, safePath);
  const traversal = relative(source.directory, fullPath);
  if (!traversal || traversal.startsWith("..") || traversal.includes("..")) throw new Error("Manual path is not allowed");
  return {
    ...source,
    markdown: readFileSync(fullPath, "utf8"),
  };
}

export function readAdminManualOverview() {
  return { ...readManualFile(ADMIN_MANUAL_OVERVIEW_FILE), title: "운영 매뉴얼" };
}

export function readAdminManualChangelog() {
  return { ...readManualFile(ADMIN_MANUAL_CHANGELOG_FILE), title: "변경 기록" };
}

export function readAdminManualProgress() {
  return { ...readManualFile(ADMIN_MANUAL_PROGRESS_FILE), title: "시스템 진행 현황" };
}

export function listAdminManualRoles() {
  const source = readAdminManualSource();
  const rolesDirectory = resolve(source.directory, ADMIN_MANUAL_ROLES_DIRECTORY);
  const filenames = existsSync(rolesDirectory)
    ? readdirSync(rolesDirectory).filter((name) => name.endsWith(".md"))
    : [];
  return {
    ...source,
    roles: listRoleManuals(filenames),
  };
}

export function readAdminManualRole(slug: string) {
  const file = roleManualFile(slug);
  return { ...readManualFile(file), title: slug, slug };
}

export function repositoryRoot() {
  const root = gitRoot();
  if (root) return root;
  const directory = findManualDirectory();
  return directory ? resolve(directory, "..") : null;
}

/** 이 제품 규칙은 매뉴얼 폴더가 아니라 저장소 뿌리에 있다. */
export function readCoreloomRules() {
  const source = readAdminManualSource();
  const root = repositoryRoot();
  if (!root) throw new Error("Product rules were not found");
  const fullPath = resolve(root, "RULES.md");
  if (!existsSync(fullPath)) throw new Error("Product rules were not found");
  return {
    ...source,
    title: "이 제품 규칙",
    markdown: readFileSync(fullPath, "utf8"),
    manualCommit: gitOutput(["log", "-1", "--format=%H", "--", "RULES.md"], root) || source.manualCommit,
  };
}

function isDirectory(path: string) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * 폴더인지까지 확인한다. 「있기만 하면」으로 고르면 같은 이름의 파일이나 엉뚱한 폴더에서 멈춰,
 * 옆에 제대로 클론된 저장소를 영영 못 본다.
 */
function findSharedManualDirectory() {
  // 자리를 직접 알려 줬으면 그 자리만 본다. 틀렸을 때 옆 폴더로 슬쩍 넘어가면
  // 잘못 적어 둔 설정이 안 드러나고, 화면은 엉뚱한 저장소를 정본처럼 보여 준다.
  const configured = process.env.CORELOOM_WORKING_METHOD_DIR?.trim();
  if (configured) {
    const directory = resolve(configured);
    return isDirectory(directory) ? directory : null;
  }
  const root = repositoryRoot();
  if (!root) return null;
  const sibling = resolve(root, "..", SHARED_MANUAL_DIRECTORY_NAME);
  return isDirectory(sibling) ? sibling : null;
}

/**
 * 홈에서 어느 칸이 열리는지 판정한다. 저장소 단위가 아니라 **파일 단위**로 센다.
 * 저장소만 보고 판정하면 홈은 링크로 보이는데 눌러 보면 「없다」가 뜬다.
 */
export function availableSharedManualSlugs() {
  const directory = findSharedManualDirectory();
  if (!directory) return new Set<string>();
  return new Set(
    SHARED_MANUAL_DOCS.filter((doc) => existsSync(resolve(directory, doc.file))).map((doc) => doc.slug),
  );
}

/**
 * 공용 정본 문서를 읽는다. 없으면 던지지 않고 `available: false`와 이유를 함께 돌려준다.
 * 화면이 빈 상태를 「내용이 없다」로 보여 주면 안 되기 때문이다.
 */
export function readSharedManual(slug: string) {
  const doc = sharedManualDoc(slug);
  const source = readAdminManualSource();
  const directory = findSharedManualDirectory();
  const missing = (reason: "no-repository" | "no-file") => ({
    ...source,
    title: doc.title,
    file: doc.file,
    available: false as const,
    reason,
    markdown: "",
  });
  if (!directory) return missing("no-repository");
  const fullPath = resolve(directory, doc.file);
  if (!existsSync(fullPath)) return missing("no-file");
  return {
    ...source,
    title: doc.title,
    file: doc.file,
    available: true as const,
    reason: null,
    markdown: readFileSync(fullPath, "utf8"),
    manualCommit: gitOutput(["log", "-1", "--format=%H", "--", doc.file], directory) || source.manualCommit,
  };
}
