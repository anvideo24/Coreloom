import { describe, expect, it } from "vitest";

import {
  clearFormDraft,
  formDraftStorageKey,
  parseFormDraft,
  readFormDraft,
  serializeFormDraft,
  writeFormDraft,
  type DraftStorage,
} from "@/lib/domain/form-draft";

function memoryStorage(initial: Record<string, string> = {}): DraftStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return data[key] ?? null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

describe("form draft isolation (F02)", () => {
  it("restores the same scope/form fields after close-style read", () => {
    const storage = memoryStorage();
    writeFormDraft(storage, {
      scopeId: "user-a",
      formId: "client-create",
      fields: { name: "UX-SYNTHETIC-UNSAVED", phone: "010-0000-0000" },
    });
    const restored = readFormDraft(storage, "user-a", "client-create");
    expect(restored?.fields.name).toBe("UX-SYNTHETIC-UNSAVED");
    expect(restored?.fields.phone).toBe("010-0000-0000");
  });

  it("does not leak drafts across users or forms", () => {
    const storage = memoryStorage();
    writeFormDraft(storage, {
      scopeId: "user-a",
      formId: "client-create",
      fields: { name: "A-ONLY" },
    });
    expect(readFormDraft(storage, "user-b", "client-create")).toBeNull();
    expect(readFormDraft(storage, "user-a", "quote-create")).toBeNull();
    expect(formDraftStorageKey("user-a", "client-create")).not.toBe(
      formDraftStorageKey("user-b", "client-create"),
    );
  });

  it("rejects stored payload when the expected scope does not match", () => {
    const raw = serializeFormDraft({
      scopeId: "user-a",
      formId: "client-create",
      fields: { name: "secret" },
    });
    expect(parseFormDraft(raw, { scopeId: "user-b", formId: "client-create" })).toBeNull();
  });

  it("clears drafts on discard and ignores empty payloads", () => {
    const storage = memoryStorage();
    writeFormDraft(storage, {
      scopeId: "user-a",
      formId: "client-create",
      fields: { name: "temp" },
    });
    clearFormDraft(storage, "user-a", "client-create");
    expect(readFormDraft(storage, "user-a", "client-create")).toBeNull();
    expect(
      writeFormDraft(storage, {
        scopeId: "user-a",
        formId: "client-create",
        fields: { name: "   " },
      }),
    ).toBeNull();
    expect(storage.data).toEqual({});
  });
});
