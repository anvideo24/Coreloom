export const rechoEvidenceKinds = ["email", "call", "meeting"] as const;

export type RechoEvidenceKind = (typeof rechoEvidenceKinds)[number];

export const rechoEvidenceKindLabels: Record<RechoEvidenceKind, string> = {
  email: "메일",
  call: "통화",
  meeting: "회의",
};

function parseIsoDate(value: string, message: string) {
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(message);
  if (Number.isNaN(new Date(`${date}T00:00:00.000Z`).getTime())) throw new Error(message);
  return date;
}

function parseClockTime(value: string) {
  const time = value.trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time);
  if (!match) throw new Error("Occurred time is required");
  return `${match[1]}:${match[2]}`;
}

function normalizeOriginalUrl(value?: string) {
  const url = value?.trim() || null;
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Original URL is invalid");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Original URL is invalid");
  }
  return url;
}

export function normalizeRechoEvidenceLink(input: {
  projectId: string;
  kind: string;
  title: string;
  originalIdentifier: string;
  originalUrl?: string;
  occurredOn: string;
  occurredTime: string;
  linkReason: string;
}): {
  projectId: string;
  kind: RechoEvidenceKind;
  title: string;
  originalIdentifier: string;
  originalUrl: string | null;
  occurredOn: string;
  occurredTime: string;
  linkReason: string;
} {
  const projectId = input.projectId.trim();
  const title = input.title.trim();
  const originalIdentifier = input.originalIdentifier.trim();
  const linkReason = input.linkReason.trim();

  if (!projectId) throw new Error("Project is required");
  if (!rechoEvidenceKinds.includes(input.kind as RechoEvidenceKind)) throw new Error("Unsupported evidence kind");
  if (!title) throw new Error("Evidence title is required");
  if (title.length > 160) throw new Error("Evidence title is too long");
  if (!originalIdentifier) throw new Error("Original identifier is required");
  if (originalIdentifier.length > 200) throw new Error("Original identifier is too long");
  if (!linkReason) throw new Error("Link reason is required");
  if (linkReason.length > 500) throw new Error("Link reason is too long");

  return {
    projectId,
    kind: input.kind as RechoEvidenceKind,
    title,
    originalIdentifier,
    originalUrl: normalizeOriginalUrl(input.originalUrl),
    occurredOn: parseIsoDate(input.occurredOn, "Occurred date is required"),
    occurredTime: parseClockTime(input.occurredTime),
    linkReason,
  };
}

export function groupEvidenceByOccurredDate<T extends { occurredOn: string; occurredTime: string }>(records: T[]) {
  const groups = new Map<string, T[]>();
  const sorted = [...records].sort((left, right) => {
    const dateCmp = right.occurredOn.localeCompare(left.occurredOn);
    if (dateCmp !== 0) return dateCmp;
    return right.occurredTime.localeCompare(left.occurredTime);
  });

  for (const record of sorted) {
    const existing = groups.get(record.occurredOn) ?? [];
    existing.push(record);
    groups.set(record.occurredOn, existing);
  }

  return [...groups.entries()].map(([occurredOn, items]) => ({ occurredOn, records: items }));
}
