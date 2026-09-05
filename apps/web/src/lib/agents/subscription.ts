import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { requireChatModel } from "../domain/agent-chat";

// ALT.LIFE와 같은 로컬 구독 CLI 경로. 키·DB·메일 비밀은 자식에 전달하지 않는다.
export function subscriptionEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "CODEX_HOME"]) {
    if (source[key]) env[key] = source[key];
  }
  return env;
}

function executable(provider: string) {
  if (provider === "gpt_codex_subscription") {
    const entry = path.join(path.dirname(process.execPath), "node_modules/@openai/codex/bin/codex.js");
    if (existsSync(entry)) return { command: process.execPath, prefix: [entry] };
    return { command: "codex", prefix: [] };
  }
  const native = path.join(homedir(), ".local/bin/claude.exe");
  return { command: existsSync(native) ? native : "claude", prefix: [] };
}

export function runSubscriptionProcess(command: string, args: string[], cwd: string, input: string, signal?: AbortSignal, timeout = 180_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("응답을 중지했습니다."));
    const child = spawn(command, args, { cwd, env: subscriptionEnvironment(), shell: false, windowsHide: true, stdio: "pipe" });
    let output = "";
    let size = 0;
    let settled = false;
    const finish = (error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (error) {
        if (process.platform === "win32" && child.pid) spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => child.kill());
        else child.kill();
        reject(new Error(error));
      } else resolve(output);
    };
    const abort = () => finish("응답을 중지했습니다.");
    const timer = setTimeout(() => finish("응답 시간이 초과됐습니다. 잠시 후 다시 보내 주세요."), timeout);
    signal?.addEventListener("abort", abort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { size += Buffer.byteLength(chunk); if (size > 1_048_576) finish("응답이 너무 깁니다. 질문을 나눠 주세요."); else output += chunk; });
    child.stderr.on("data", () => {}); // CLI 진단에는 프롬프트·계정 정보가 포함될 수 있다.
    child.stdin.on("error", () => finish("구독 실행기에 요청을 전달하지 못했습니다."));
    child.on("error", () => finish("이 PC의 구독 실행기를 찾지 못했습니다."));
    child.on("close", (code) => finish(code === 0 ? undefined : "구독 응답에 실패했습니다. 로그인·사용 한도·모델 연결을 확인해 주세요."));
    child.stdin.end(input, "utf8");
  });
}

export async function subscriptionStatus(provider: string) {
  if (provider === "cursor_agent") return false;
  const exe = executable(provider);
  try {
    const output = await runSubscriptionProcess(exe.command, [...exe.prefix, ...(provider === "gpt_codex_subscription" ? ["login", "status"] : ["auth", "status"])], tmpdir(), "", undefined, 10_000);
    // Codex prints login status to stderr; auth mode is checked separately below.
    if (provider === "gpt_codex_subscription") {
      const auth = JSON.parse(await readFile(path.join(process.env.CODEX_HOME || path.join(homedir(), ".codex"), "auth.json"), "utf8"));
      return auth.auth_mode === "chatgpt";
    }
    const auth = JSON.parse(output);
    return auth.loggedIn === true && auth.authMethod === "claude.ai";
  } catch { return false; }
}

export async function generateSubscriptionReply(modelId: string, prompt: string, signal?: AbortSignal) {
  const model = requireChatModel(modelId);
  if (!await subscriptionStatus(model.provider)) throw new Error("이 PC에서 해당 구독 계정 로그인이 필요합니다.");
  const directory = await mkdtemp(path.join(tmpdir(), "coreloom-chat-"));
  const exe = executable(model.provider);
  try {
    if (model.provider === "gpt_codex_subscription") {
      const outputPath = path.join(directory, "reply.txt");
      await runSubscriptionProcess(exe.command, [...exe.prefix, "exec", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check", "--sandbox", "read-only", "-c", "features.shell_tool=false", "-c", "features.unified_exec=false", "--model", model.id, "--output-last-message", outputPath, "-C", directory, "-"], directory, prompt, signal);
      const reply = (await readFile(outputPath, "utf8")).trim();
      if (!reply || reply.length > 32_000) throw new Error("응답이 비어 있거나 너무 깁니다.");
      return reply;
    }
    const output = await runSubscriptionProcess(exe.command, ["-p", "--safe-mode", "--tools", "", "--strict-mcp-config", "--no-session-persistence", "--model", model.id, "--output-format", "json"], directory, prompt, signal);
    const result = JSON.parse(output);
    if (result.is_error || typeof result.result !== "string" || !result.result.trim() || result.result.length > 32_000) throw new Error("구독 실행기가 답변을 반환하지 않았습니다.");
    return result.result.trim() as string;
  } finally {
    // mkdtemp로 이 호출에서 만든 폴더만 정리한다.
    await rm(directory, { recursive: true, force: true, maxRetries: 2 }).catch(() => {});
  }
}
