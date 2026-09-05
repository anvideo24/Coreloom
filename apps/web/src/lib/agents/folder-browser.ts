import "server-only";

import { lstat, opendir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { noLinks, safeParts, validateReadRoot } from "./read-files";

const MAX_FOLDERS = 100;
const MAX_ENTRIES = 1000;
const TIME_LIMIT_MS = 4000;

type FolderEntry = { name: string; path: string };
export type BrowseAgentFoldersResult = {
  currentPath: string | null;
  label: string;
  parentPath: string | null;
  canSelect: boolean;
  entries: FolderEntry[];
  truncated: boolean;
};

function isDriveRoot(value: string) {
  const resolved = path.resolve(value);
  return resolved === path.parse(resolved).root;
}

function isHome(value: string) {
  return path.resolve(value).toLowerCase() === os.homedir().toLowerCase();
}

function canSelect(value: string) {
  return !isDriveRoot(value) && !isHome(value);
}

async function assertBrowseable(value: string, deadline: number) {
  if (!path.isAbsolute(value) || value.includes("\0") || value.startsWith("\\\\") || !safeParts(value)) {
    throw new Error("폴더를 탐색할 수 없습니다.");
  }
  const resolved = path.resolve(value);
  // Keep the read boundary as the authority for protected roots and ancestors.
  // It intentionally rejects home/drive roots; those remain browse-only below.
  if (!isDriveRoot(resolved) && !isHome(resolved)) await bounded(validateReadRoot(resolved), deadline);
  const stat = await bounded(lstat(resolved), deadline).catch(() => null);
  if (!stat?.isDirectory() || stat.isSymbolicLink()) throw new Error("폴더를 탐색할 수 없습니다.");
  await bounded(noLinks(resolved), deadline);
  return resolved;
}

async function bounded<T>(work: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("폴더를 탐색할 수 없습니다.")), Math.max(1, deadline - Date.now())); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

async function childFolders(directory: string, deadline: number) {
  const entries: FolderEntry[] = [];
  let truncated = false;
  const handle = await bounded(opendir(directory), deadline).catch(() => { throw new Error("폴더를 탐색할 수 없습니다."); });
  let folderCount = 0;
  let inspected = 0;
  try {
    while (inspected < MAX_ENTRIES) {
      if (Date.now() >= deadline) { truncated = true; break; }
      const result = await bounded(handle.read(), deadline).catch(() => { truncated = true; return null; });
      if (!result) break;
      inspected++;
      const entry = result;
      if (!entry.isDirectory() || entry.isSymbolicLink() || !safeParts(entry.name)) continue;
      if (++folderCount > MAX_FOLDERS) { truncated = true; break; }
      const child = path.join(directory, entry.name);
      try {
        await assertBrowseable(child, deadline);
        entries.push({ name: entry.name, path: child });
      } catch { /* inaccessible or protected children are omitted */ }
    }
    if (inspected >= MAX_ENTRIES) truncated = true;
  } finally { await handle.close().catch(() => undefined); }
  return { entries, truncated };
}

async function browseRoots(deadline: number) {
  const entries: FolderEntry[] = [];
  const home = os.homedir();
  if (process.platform === "win32") {
    // Windows has no portable drive enumeration API in Node; probing roots is read-only.
    for (let code = 65; code <= 90 && Date.now() < deadline && entries.length < MAX_FOLDERS; code++) {
      const drive = `${String.fromCharCode(code)}:${path.sep}`;
      try {
        const stat = await bounded(lstat(drive), deadline);
        if (stat.isDirectory() && !stat.isSymbolicLink()) entries.push({ name: `${String.fromCharCode(code)}:`, path: drive });
      } catch { /* drive is not mounted */ }
    }
  } else {
    entries.push({ name: "로컬 루트", path: path.parse(home).root });
  }
  if (Date.now() < deadline) {
    entries.push({ name: "서버 홈", path: home });
  }
  return { entries, truncated: Date.now() >= deadline };
}

export async function browseAgentFolders(folder: string | null): Promise<BrowseAgentFoldersResult> {
  const deadline = Date.now() + TIME_LIMIT_MS;
  if (folder === null) {
    const roots = await browseRoots(deadline);
    return { currentPath: null, label: "서버 PC", parentPath: null, canSelect: false, ...roots };
  }
  const current = await assertBrowseable(folder, deadline);
  const { entries, truncated } = await childFolders(current, deadline);
  const parent = path.dirname(current);
  return {
    currentPath: current,
    label: isDriveRoot(current) ? path.parse(current).root : path.basename(current),
    parentPath: isDriveRoot(current) || isHome(current) ? null : parent,
    canSelect: canSelect(current),
    entries,
    truncated,
  };
}
