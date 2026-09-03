import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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
} from "@/lib/domain/admin-manual";

function gitOutput(args: string[], cwd: string) {
  try {
    return execFileSync("git", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function findManualDirectory() {
  const candidates: string[] = [];
  const gitRoot = gitOutput(["rev-parse", "--show-toplevel"], process.cwd());
  if (gitRoot) candidates.push(resolve(gitRoot, "manual"));
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
  const gitRoot = gitOutput(["rev-parse", "--show-toplevel"], process.cwd()) || resolve(directory, "..");
  const deployCommit = gitOutput(["rev-parse", "HEAD"], gitRoot) || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "";
  const manualCommit = gitOutput(["log", "-1", "--format=%H", "--", "manual"], gitRoot) || deployCommit;
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
