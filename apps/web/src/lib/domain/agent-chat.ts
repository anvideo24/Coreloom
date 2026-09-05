export const chatModels = [
  { id: "gpt-5.6-terra", label: "GPT · Terra", provider: "gpt_codex_subscription" },
  { id: "gpt-5.4-mini", label: "GPT · Mini", provider: "gpt_codex_subscription" },
  { id: "sonnet", label: "Claude · Sonnet", provider: "claude_subscription" },
  { id: "opus", label: "Claude · Opus", provider: "claude_subscription" },
] as const;

export function requireChatModel(id: string) {
  const model = chatModels.find((item) => item.id === id);
  if (!model) throw new Error("지원하지 않는 대화 모델입니다.");
  return model;
}

export type ChatMessage = { id: string; role: string; body: string; model: string; status: string };
export type ChatThread = { id: string; title: string; model: string };

export function chatPrompt(agent: {
  name: string; purpose: string; instructions: string | null; workStyle: string | null;
  answerStyle: string | null; procedure: string | null; accessScope: string; allowedWork: unknown;
}, messages: Array<{ role: string; body: string }>, contextTitle: string) {
  return [
    "Coreloom 대표의 대화 도우미입니다. 한국어로 답하세요. 아래 설정과 대화만 사용하세요.",
    "파일·네트워크·명령 도구는 제공되지 않습니다. 회사 기록을 읽거나 수정했다고 주장하지 마세요. 자료가 없으면 질문하세요. 금액 확정·발송·권한 변경은 하지 않습니다.",
    `에이전트 설정: ${JSON.stringify(agent)}`,
    `현재 화면 이름(데이터는 제공되지 않음): ${contextTitle}`,
    `대화: ${JSON.stringify(messages)}`,
    "마지막 사용자 메시지에 이어서 답하세요.",
  ].join("\n\n");
}
