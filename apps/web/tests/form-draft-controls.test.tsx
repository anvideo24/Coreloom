// @vitest-environment jsdom
/**
 * F02-02(초안 버리기) · F02-03(같은 것 두 번 저장 막기) 시험.
 *
 * F02-01과 같은 방식으로, 실제 화면에 쓰는 컴포넌트(`DraftAwareForm` + `ClientCompanyFields`
 * + `DraftDiscardButton` + `DraftSubmitButton`)를 그대로 렌더해서 잰다. 상황을 흉내 낸 방식은
 * `form-draft-scenarios.test.tsx`와 같다 — 닫기→재열기는 unmount 후 재mount, 새로고침은
 * unmount+cleanup 후 새 render() 호출이다.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ClientCompanyFields } from "@/components/client-company-fields";
import { DraftAwareForm } from "@/components/draft-aware-form";
import { DraftDiscardButton } from "@/components/draft-discard-button";
import { DraftSubmitButton } from "@/components/draft-submit-button";
import { readFormDraft } from "@/lib/domain/form-draft";
import { claimSubmission, createSubmissionRegistry } from "@/lib/domain/submission-dedupe";

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

const SCOPE = "UX-SYNTHETIC-SCOPE-CONTROLS";
const FORM_ID = "client-create";

function renderForm(action: (formData: FormData) => void | Promise<void>) {
  return render(
    <DraftAwareForm action={action} formId={FORM_ID} scopeId={SCOPE}>
      <ClientCompanyFields includeFirstContact />
      <DraftSubmitButton className="auth-submit">고객사 저장</DraftSubmitButton>
      <DraftDiscardButton />
    </DraftAwareForm>,
  );
}

function fillName(value: string) {
  fireEvent.change(screen.getByPlaceholderText("예: 주식회사 예시"), { target: { value } });
}

function nameValue() {
  return (screen.getByPlaceholderText("예: 주식회사 예시") as HTMLInputElement).value;
}

/** 진행 중인 저장 요청을 흉내 내기 위해, 밖에서 원하는 시점에 끝낼 수 있는 Promise. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("F02-02 초안 버리기", () => {
  it("초안이 없으면 버리기가 안 보인다", () => {
    renderForm(vi.fn());
    expect(screen.queryByText("이 초안 버리기")).toBeNull();
  });

  it("입력하면 버리기가 나타난다", () => {
    renderForm(vi.fn());
    fillName("UX-SYNTHETIC-이름");
    expect(screen.getByText("이 초안 버리기")).toBeTruthy();
  });

  it("한 번만 눌러서는 지워지지 않는다 — 확인 단계가 있다(window.confirm 없이)", () => {
    renderForm(vi.fn());
    fillName("UX-SYNTHETIC-이름");
    fireEvent.click(screen.getByText("이 초안 버리기"));

    // 아직 확인 전이다. 저장소도 화면 값도 그대로 남아 있어야 한다.
    expect(readFormDraft(sessionStorage, SCOPE, FORM_ID)?.fields.name).toBe("UX-SYNTHETIC-이름");
    expect(nameValue()).toBe("UX-SYNTHETIC-이름");
    expect(screen.getByText("정말 버릴까요")).toBeTruthy();
    expect(screen.getByText("취소")).toBeTruthy();
  });

  it("취소를 누르면 아무 것도 지워지지 않고 원래 버튼으로 돌아온다", () => {
    renderForm(vi.fn());
    fillName("UX-SYNTHETIC-이름");
    fireEvent.click(screen.getByText("이 초안 버리기"));
    fireEvent.click(screen.getByText("취소"));

    expect(nameValue()).toBe("UX-SYNTHETIC-이름");
    expect(readFormDraft(sessionStorage, SCOPE, FORM_ID)?.fields.name).toBe("UX-SYNTHETIC-이름");
    expect(screen.getByText("이 초안 버리기")).toBeTruthy();
  });

  it("확인까지 누르면 저장소도 지워지고 화면 입력칸(text)도 함께 빈다", () => {
    renderForm(vi.fn());
    fillName("UX-SYNTHETIC-이름");
    fireEvent.click(screen.getByText("이 초안 버리기"));
    fireEvent.click(screen.getByText("정말 버릴까요"));

    expect(readFormDraft(sessionStorage, SCOPE, FORM_ID)).toBeNull();
    expect(nameValue()).toBe("");
    // 초안이 없으니 버리기 버튼도 다시 숨는다(늘 떠 있으면 시끄럽다).
    expect(screen.queryByText("이 초안 버리기")).toBeNull();
  });

  it("확인까지 누르면 select 필드도 초기값으로 돌아간다", () => {
    renderForm(vi.fn());
    fillName("UX-SYNTHETIC-이름");
    fireEvent.change(screen.getByRole("combobox", { name: "과세 유형" }), { target: { value: "simplified" } });
    fireEvent.click(screen.getByText("이 초안 버리기"));
    fireEvent.click(screen.getByText("정말 버릴까요"));

    expect((screen.getByRole("combobox", { name: "과세 유형" }) as HTMLSelectElement).value).toBe("");
  });

  it("버리기 → 재열기(unmount 후 같은 scope/form으로 다시 mount)에도 되살아나지 않는다", () => {
    const { unmount } = renderForm(vi.fn());
    fillName("UX-SYNTHETIC-이름");
    fireEvent.click(screen.getByText("이 초안 버리기"));
    fireEvent.click(screen.getByText("정말 버릴까요"));
    unmount();

    renderForm(vi.fn());
    expect(nameValue()).toBe("");
    expect(screen.queryByText("이 초안 버리기")).toBeNull();
  });

  it("버리기 → 새로고침(컴포넌트를 버리고 새 렌더)에도 되살아나지 않는다", () => {
    const { unmount } = renderForm(vi.fn());
    fillName("UX-SYNTHETIC-이름");
    fireEvent.click(screen.getByText("이 초안 버리기"));
    fireEvent.click(screen.getByText("정말 버릴까요"));
    unmount();
    cleanup();

    renderForm(vi.fn());
    expect(nameValue()).toBe("");
    expect(readFormDraft(sessionStorage, SCOPE, FORM_ID)).toBeNull();
  });
});

describe("F02-03 같은 것 두 번 저장 막기 — 화면 방어", () => {
  it("제출 중에는 저장 버튼이 눌리지 않는다(연타 방지)", async () => {
    const { promise, resolve } = deferred<void>();
    const action = vi.fn().mockReturnValue(promise);
    renderForm(action);
    fillName("UX-SYNTHETIC-이름");

    fireEvent.click(screen.getByRole("button", { name: "고객사 저장" }));
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "고객사 저장" }) as HTMLButtonElement).disabled).toBe(true);
    });

    // 두 번째 클릭 — 비활성 버튼은 클릭을 받지 않는다.
    fireEvent.click(screen.getByRole("button", { name: "고객사 저장" }));
    expect(action).toHaveBeenCalledTimes(1);

    resolve();
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "고객사 저장" }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it("제출마다 다른 식별자를 함께 보내고, 성공한 뒤에는 다음 제출에 새 식별자를 쓴다", async () => {
    const seenSubmissionIds: string[] = [];
    const action = vi.fn(async (formData: FormData) => {
      seenSubmissionIds.push(String(formData.get("submissionId")));
    });
    renderForm(action);

    fillName("UX-SYNTHETIC-이름-1");
    fireEvent.click(screen.getByText("고객사 저장"));
    // 「action이 불렸다」와 「성공 처리가 끝났다」는 다르다. 식별자를 새로 바꾸는 것은 뒤쪽이라,
    // 앞쪽만 기다리고 두 번째를 누르면 같은 식별자가 가는 게 정상인데 시험은 실패로 읽는다.
    // 성공이 끝나면 초안이 지워져 버리기 버튼이 사라진다 — 그 신호를 기다린다.
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("이 초안 버리기")).toBeNull());

    fillName("UX-SYNTHETIC-이름-2");
    fireEvent.click(screen.getByText("고객사 저장"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));

    expect(seenSubmissionIds).toHaveLength(2);
    expect(seenSubmissionIds[0]).toBeTruthy();
    expect(seenSubmissionIds[1]).toBeTruthy();
    expect(seenSubmissionIds[0]).not.toBe(seenSubmissionIds[1]);
  });

  it("한계를 감추지 않는다 — 새로고침 뒤에는 화면의 '제출 중' 방어가 사라진다", async () => {
    const { promise } = deferred<void>();
    const action = vi.fn().mockReturnValue(promise);
    const { unmount } = renderForm(action);
    fillName("UX-SYNTHETIC-이름");
    fireEvent.click(screen.getByRole("button", { name: "고객사 저장" }));
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "고객사 저장" }) as HTMLButtonElement).disabled).toBe(true);
    });

    // 새로고침을 흉내 낸다: 컴포넌트를 통째로 버리고 새 인스턴스를 새로 올린다. 실제로는 앞선
    // 요청이 서버에서 여전히 처리 중일 수 있지만, 이 화면에는 그 사실이 전혀 남지 않는다 —
    // 화면 방어만으로 F02-03을 "다 막았다"고 적으면 안 되는 이유가 이것이다.
    unmount();
    cleanup();
    renderForm(vi.fn());
    expect((screen.getByRole("button", { name: "고객사 저장" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("F02-03 같은 것 두 번 저장 막기 — 서버 쪽 판정 자리(순수 함수, 아직 미연결)", () => {
  it("처음 보는 식별자는 통과시키고, 같은 식별자 재시도는 중복으로 판정한다", () => {
    const registry = createSubmissionRegistry();
    expect(claimSubmission(registry, "UX-SYNTHETIC-SUBMISSION-1").duplicate).toBe(false);
    expect(claimSubmission(registry, "UX-SYNTHETIC-SUBMISSION-1").duplicate).toBe(true);
    expect(claimSubmission(registry, "UX-SYNTHETIC-SUBMISSION-2").duplicate).toBe(false);
  });

  it("같은 식별자로 재시도해도 저장 결과 건수가 늘지 않는다(가짜 저장소로 대조)", () => {
    const registry = createSubmissionRegistry();
    const savedDocuments: string[] = [];

    function fakeServerSave(submissionId: string, payload: string) {
      const { duplicate } = claimSubmission(registry, submissionId);
      if (duplicate) return;
      savedDocuments.push(payload);
    }

    fakeServerSave("UX-SYNTHETIC-SUBMISSION-A", "UX-SYNTHETIC-문서-1");
    fakeServerSave("UX-SYNTHETIC-SUBMISSION-A", "UX-SYNTHETIC-문서-1"); // 같은 식별자로 재시도
    fakeServerSave("UX-SYNTHETIC-SUBMISSION-B", "UX-SYNTHETIC-문서-2");

    expect(savedDocuments).toEqual(["UX-SYNTHETIC-문서-1", "UX-SYNTHETIC-문서-2"]);
  });
});
