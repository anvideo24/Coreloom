import { describe, expect, it } from "vitest";

import { groupEvidenceByOccurredDate, normalizeRechoEvidenceLink, rechoEvidenceKinds } from "@/lib/domain/recho-evidence";

describe("recho evidence linking", () => {
  it("keeps a project-linked original identifier, time, and reason", () => {
    expect(normalizeRechoEvidenceLink({
      projectId: "project-1",
      kind: "email",
      title: " 견적 회신  ",
      originalIdentifier: "  recho-record-sample-1  ",
      originalUrl: " https://example.com/recho/records/sample-1 ",
      occurredOn: "2026-09-03",
      occurredTime: "14:30",
      linkReason: " 견적 범위 합의의 근거 ",
    })).toEqual({
      projectId: "project-1",
      kind: "email",
      title: "견적 회신",
      originalIdentifier: "recho-record-sample-1",
      originalUrl: "https://example.com/recho/records/sample-1",
      occurredOn: "2026-09-03",
      occurredTime: "14:30",
      linkReason: "견적 범위 합의의 근거",
    });
  });

  it("allows a call without an original URL", () => {
    expect(normalizeRechoEvidenceLink({
      projectId: "project-1",
      kind: "call",
      title: "착수 일정 통화",
      originalIdentifier: "recho-call-sample-1",
      occurredOn: "2026-09-02",
      occurredTime: "09:05",
      linkReason: "착수일 조율",
    })).toEqual({
      projectId: "project-1",
      kind: "call",
      title: "착수 일정 통화",
      originalIdentifier: "recho-call-sample-1",
      originalUrl: null,
      occurredOn: "2026-09-02",
      occurredTime: "09:05",
      linkReason: "착수일 조율",
    });
  });

  it("rejects missing project, identifier, reason, or invalid URL and time", () => {
    const valid = {
      projectId: "project-1",
      kind: "meeting",
      title: "킥오프",
      originalIdentifier: "recho-meeting-sample-1",
      occurredOn: "2026-09-01",
      occurredTime: "10:00",
      linkReason: "범위 확인",
    };

    expect(() => normalizeRechoEvidenceLink({ ...valid, projectId: " " })).toThrow("Project is required");
    expect(() => normalizeRechoEvidenceLink({ ...valid, kind: "note" })).toThrow("Unsupported evidence kind");
    expect(() => normalizeRechoEvidenceLink({ ...valid, originalIdentifier: " " })).toThrow("Original identifier is required");
    expect(() => normalizeRechoEvidenceLink({ ...valid, linkReason: " " })).toThrow("Link reason is required");
    expect(() => normalizeRechoEvidenceLink({ ...valid, originalUrl: "not-a-url" })).toThrow("Original URL is invalid");
    expect(() => normalizeRechoEvidenceLink({ ...valid, occurredTime: "25:00" })).toThrow("Occurred time is required");
    expect(normalizeRechoEvidenceLink({ ...valid, occurredTime: "14:30:00" }).occurredTime).toBe("14:30");
  });

  it("exposes only mail, call, and meeting kinds", () => {
    expect(rechoEvidenceKinds).toEqual(["email", "call", "meeting"]);
  });
});

describe("recho evidence timeline", () => {
  it("groups records by occurred date, newest first", () => {
    expect(groupEvidenceByOccurredDate([
      { occurredOn: "2026-09-01", occurredTime: "10:00", title: "이전" },
      { occurredOn: "2026-09-03", occurredTime: "09:00", title: "아침" },
      { occurredOn: "2026-09-03", occurredTime: "14:30", title: "오후" },
    ])).toEqual([
      {
        occurredOn: "2026-09-03",
        records: [
          { occurredOn: "2026-09-03", occurredTime: "14:30", title: "오후" },
          { occurredOn: "2026-09-03", occurredTime: "09:00", title: "아침" },
        ],
      },
      {
        occurredOn: "2026-09-01",
        records: [{ occurredOn: "2026-09-01", occurredTime: "10:00", title: "이전" }],
      },
    ]);
  });
});
