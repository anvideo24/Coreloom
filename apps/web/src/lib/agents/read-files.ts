import { lstat, realpath, readdir, open } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";

const extensions = new Set([".txt", ".md", ".csv", ".json"]);
const blocked = /^(?:\..*|node_modules|appdata|windows|program files(?: \(x86\))?|programdata|library|google|chrome|chromium|edge|firefox|credentials?|secrets?|tokens?|passwords?|auth)(?:$|[._-])/i;
const secretText = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:password|passwd|token|secret|authorization|cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|cookie[_-]?secret)\s*["']?\s*[:=]\s*\S+|postgres(?:ql)?:\/\/|\bsk-[A-Za-z0-9_-]{16,}|\bnpg_[A-Za-z0-9]+|https?:\/\/[^\s/]*\.ts\.net\b)/i;
export function safeParts(value: string) { return value.split(/[\\/]+/).every((p) => !blocked.test(p)); }
function inside(root: string, target: string) { const relative = path.relative(root, target); return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative); }
export async function noLinks(target: string) {
  let current = path.parse(target).root;
  for (const part of target.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error("링크 경로는 허용하지 않습니다.");
  }
}
export async function validateReadRoot(value: string) {
  if (!path.isAbsolute(value) || value.startsWith("\\\\") || value.includes("\0")) throw new Error("로컬 절대 폴더 경로가 필요합니다.");
  const root = path.resolve(value);
  if (root === path.parse(root).root || root.toLowerCase() === homedir().toLowerCase() || inside(root, homedir()) || !safeParts(root)) throw new Error("범위가 넓거나 보호된 폴더입니다.");
  await noLinks(root);
  if (!(await lstat(root)).isDirectory()) throw new Error("폴더가 아닙니다.");
  return realpath(root);
}
export async function searchReadFiles(roots: string[], query: string) {
  const rows: Array<{ root: number; path: string }> = [];
  let visited = 0;
  const deadline = Date.now() + 4000;
  for (let index = 0; index < roots.length; index++) {
    const root = await validateReadRoot(roots[index]);
    const queue = [{ directory: root, depth: 0 }];
    while (queue.length && rows.length < 40 && visited < 1200 && Date.now() < deadline) {
      const next = queue.shift()!;
      await noLinks(next.directory);
      for (const entry of await readdir(next.directory, { withFileTypes: true }).catch(() => [])) {
        if (++visited > 1200 || rows.length >= 40 || Date.now() >= deadline) break;
        if (entry.isSymbolicLink() || !safeParts(entry.name)) continue;
        const file = path.join(next.directory, entry.name);
        if (entry.isDirectory() && next.depth < 5) queue.push({ directory: file, depth: next.depth + 1 });
        if (entry.isFile() && extensions.has(path.extname(file).toLowerCase()) && entry.name.toLowerCase().includes(query.toLowerCase())) rows.push({ root: index, path: path.relative(root, file).split(path.sep).join("/") });
      }
    }
  }
  return { rows, sources: rows.map((r) => `PC 폴더 ${r.root + 1}/${r.path}`), limited: true, note: "파일명 검색 · 최대 40건/1200항목/깊이5. 전체 PC 검색이 아닙니다." };
}
export async function readAllowedFile(roots: string[], index: number, relative: string) {
  if (!roots[index] || !relative || relative.includes(":") || relative.includes("\\") || relative.split("/").some((p) => !p || p === "." || p === "..") || !safeParts(relative)) throw new Error("허용되지 않은 경로입니다.");
  const root = await validateReadRoot(roots[index]), target = path.resolve(root, relative);
  if (!inside(root, target) || !extensions.has(path.extname(target).toLowerCase())) throw new Error("허용된 텍스트 파일만 읽습니다.");
  await noLinks(target);
  const before = await lstat(target);
  if (!before.isFile() || before.nlink !== 1 || before.size > 64000) throw new Error("일반 파일 64KB 이하만 읽습니다.");
  const handle = await open(target, "r");
  try {
    const now = await handle.stat();
    if (now.ino !== before.ino || now.dev !== before.dev || now.size > 64000 || now.nlink !== 1) throw new Error("파일이 변경됐습니다.");
    await noLinks(target);
    if (!inside(root, await realpath(target))) throw new Error("경로가 변경됐습니다.");
    const buffer = Buffer.alloc(64001); const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 64000) throw new Error("파일이 너무 큽니다.");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead));
    if (text.includes("\0") || secretText.test(text)) throw new Error("비밀정보가 의심되는 파일은 보내지 않습니다.");
    return { text: text.slice(0, 16000), truncated: text.length > 16000, sources: [`PC 폴더 ${index + 1}/${relative}`] };
  } finally { await handle.close(); }
}
