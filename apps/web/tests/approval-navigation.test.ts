import { describe, expect, it } from "vitest";

import {
  approvalNavigationStorageKey,
  parseApprovalNavigation,
  restoreApprovalNavigation,
  serializeApprovalNavigation,
} from "@/lib/domain/approval-navigation";

const items = [
  { id: "expense:first", kind: "expense" as const },
  { id: "revenue:second", kind: "revenue" as const },
];

describe("approval return navigation", () => {
  it("keeps this founder's search, kind, inspected item and visible position in one tab record", () => {
    const raw = serializeApprovalNavigation({
      scopeId: "founder-a",
      query: "검토 중",
      selectedKind: "expense",
      inspectedItemId: "expense:first",
      inspectedPosition: 3,
    });

    expect(approvalNavigationStorageKey("founder-a")).toBe("coreloom.approval-navigation.v1:founder-a");
    expect(parseApprovalNavigation(raw, "founder-a")).toMatchObject({
      query: "검토 중",
      selectedKind: "expense",
      inspectedItemId: "expense:first",
      inspectedPosition: 3,
    });
  });

  it("never restores another founder's saved navigation", () => {
    const raw = serializeApprovalNavigation({ scopeId: "founder-a", query: "private", selectedKind: null });
    expect(parseApprovalNavigation(raw, "founder-b")).toBeNull();
  });

  it("keeps filters but safely drops a stale inspected item", () => {
    const restored = restoreApprovalNavigation({
      version: 1,
      scopeId: "founder-a",
      query: "매출",
      selectedKind: "revenue",
      inspectedItemId: "deleted:item",
      inspectedPosition: 4,
    }, items);

    expect(restored).toEqual({ query: "매출", selectedKind: "revenue", inspectedPosition: null });
  });

  it("uses the current list position when the inspected item is still present", () => {
    const restored = restoreApprovalNavigation({
      version: 1,
      scopeId: "founder-a",
      query: "",
      selectedKind: null,
      inspectedItemId: "revenue:second",
      inspectedPosition: 99,
    }, items);

    expect(restored).toEqual({ query: "", selectedKind: null, inspectedPosition: 1 });
  });

  it("rejects malformed or unsupported records", () => {
    expect(parseApprovalNavigation("{", "founder-a")).toBeNull();
    expect(parseApprovalNavigation(JSON.stringify({ version: 1, scopeId: "founder-a", query: "x", selectedKind: "unknown" }), "founder-a")).toBeNull();
  });
});
