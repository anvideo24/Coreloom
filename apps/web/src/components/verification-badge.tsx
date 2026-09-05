import { outcomeLabel, type EffectiveOutcome } from "@/lib/domain/verification-plan";

/** 상태값을 화면에서 직접 번역하지 않는다 — 라벨은 outcomeLabel 한 곳에서만 온다. 여기는 색만 고른다. */
const TONE: Record<EffectiveOutcome, string> = {
  pass: "badge-done",
  fail: "badge-danger",
  unverified: "badge-warn",
  "needs-recheck": "badge-warn",
  excluded: "badge-pending",
  "no-result": "badge-pending",
};

export function VerificationOutcomeBadge({ outcome }: { outcome: EffectiveOutcome }) {
  return <span className={`badge ${TONE[outcome]}`}>{outcomeLabel(outcome)}</span>;
}
