// @vitest-environment jsdom
/**
 * 나가는 길(F02-04). 이 제품에는 로그아웃이 아예 없었다 — 공용 PC나 잃어버린 기기에서
 * 세션을 끊을 방법이 없었다는 뜻이다.
 *
 * 여기서 재는 것은 셋이다.
 *  - 한 번에 나가지지 않는다(잘못 눌러 작업을 잃지 않게)
 *  - 서버가 끊었다고 답해야 나간다. 화면만 바꾸고 세션이 살아 있으면 더 나쁘다
 *  - 나갈 때 이 브라우저에 남은 작성 중 초안도 지운다
 *
 * 실제 서버는 못 부르므로 인증 클라이언트를 대신 세운다. 그 경계를 넘는 것(진짜 세션이
 * 정말 끊겼는지)은 대표가 화면에서 확인할 몫이다.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const signOut = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/auth/client", () => ({ authClient: { signOut: () => signOut() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { SignOutButton } from "@/components/sign-out-button";
import { formDraftStorageKey, serializeFormDraft } from "@/lib/domain/form-draft";

beforeEach(() => {
  signOut.mockReset();
  replace.mockReset();
  refresh.mockReset();
  window.sessionStorage.clear();
});

afterEach(cleanup);

function seedDraft(scopeId: string, formId: string) {
  window.sessionStorage.setItem(
    formDraftStorageKey(scopeId, formId),
    serializeFormDraft({ scopeId, formId, fields: { name: "UX-SYNTHETIC-UNSAVED" } }),
  );
}

describe("나가는 길", () => {
  it("한 번 눌러서는 안 나간다. 되묻는다", () => {
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(signOut, "묻지도 않고 나가면 잘못 눌러 작업을 잃는다").not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "정말 나갈까요" })).toBeTruthy();
  });

  it("취소하면 아무 일도 없다", () => {
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();
  });

  it("확인하면 나가고, 이 브라우저의 작성 중 초안도 지운다", async () => {
    seedDraft("founder-a", "client-create");
    seedDraft("founder-a", "quote-create");
    window.sessionStorage.setItem("coreloom.other", "남의 값");
    signOut.mockResolvedValue({ data: { success: true }, error: null });

    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.click(screen.getByRole("button", { name: "정말 나갈까요" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
    expect(window.sessionStorage.getItem(formDraftStorageKey("founder-a", "client-create"))).toBeNull();
    expect(window.sessionStorage.getItem(formDraftStorageKey("founder-a", "quote-create"))).toBeNull();
    expect(window.sessionStorage.getItem("coreloom.other"), "초안이 아닌 값까지 지우면 안 된다").toBe("남의 값");
  });

  it("서버가 거부하면 나가지 않고 그 사실을 말한다", async () => {
    seedDraft("founder-a", "client-create");
    signOut.mockResolvedValue({ data: null, error: { message: "denied" } });

    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.click(screen.getByRole("button", { name: "정말 나갈까요" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(replace, "서버가 안 끊었는데 화면만 바꾸면 나간 줄 안다").not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem(formDraftStorageKey("founder-a", "client-create")),
      "안 나갔으면 초안도 그대로 있어야 한다",
    ).not.toBeNull();
  });

  it("요청이 통째로 실패해도 화면이 죽지 않고 다시 시도할 수 있다", async () => {
    signOut.mockRejectedValue(new Error("network"));
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.click(screen.getByRole("button", { name: "정말 나갈까요" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("서버가 로그아웃을 확인한 뒤에만 승인함 탐색 기록을 지운다", async () => {
    const key = "coreloom.approval-navigation.v1:founder-a";
    window.sessionStorage.setItem(key, JSON.stringify({ query: "UX-SYNTHETIC", selectedKind: "expense" }));
    window.sessionStorage.setItem("coreloom.other", "preserve");
    signOut.mockResolvedValueOnce({ error: { message: "denied" } });
    render(<SignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.click(screen.getByRole("button", { name: "정말 나갈까요" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(window.sessionStorage.getItem(key)).not.toBeNull();

    signOut.mockResolvedValueOnce({ data: { success: true }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.click(screen.getByRole("button", { name: "정말 나갈까요" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(window.sessionStorage.getItem("coreloom.other")).toBe("preserve");
  });
});
