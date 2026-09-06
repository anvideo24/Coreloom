// @vitest-environment jsdom
/**
 * F02-01 — PC 8조합 실측: {고객사 폼, 견적 폼} × {닫기→재열기, 새로고침, 다른 화면 이동→복귀, 저장 실패→복구}.
 *
 * 실제 휴대폰 8조합은 사람이 기기로 재야 하므로 이 파일의 범위가 아니다(미측정으로 남는다).
 *
 * 여기서는 초안 저장을 실제로 담당하는 `DraftAwareForm` 컴포넌트를, 각 폼이 실제로 쓰는
 * 필드 컴포넌트(`ClientCompanyFields`, `QuoteClientProjectFields`, `QuoteCostingComposer`)와
 * 함께 그대로 렌더해서 잰다. 폼 컴포넌트를 거치지 않은 시나리오는 없다 — 모두 실제 DOM·React
 * 트리를 통해 채우고 저장하고, unmount/remount 등으로 상황을 흉내 낸 뒤 화면에 보이는 값을
 * 저장 전 값과 대조한다.
 *
 * 상황을 흉내 낸 방식(정직하게 밝힘):
 * - 닫기→재열기: 폼을 unmount했다가 같은 scopeId/formId로 다시 mount한다.
 * - 새로고침: 컴포넌트를 버리고(unmount) sessionStorage만 남긴 채 새 React root에 새로 mount한다.
 *   실제 새로고침처럼 모듈 top-level 상태에 기대지 않기 위해, 매번 새 컨테이너/새 render() 호출을 쓴다.
 * - 다른 화면 이동→복귀: formId가 다른 폼(패널)을 열었다 닫고, 원래 formId로 다시 연다.
 * - 저장 실패→복구: action이 reject하는 시험 안에서만 실패를 주입한다. 서버는 건드리지 않는다.
 */
import React from "react";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { DraftAwareForm } from "@/components/draft-aware-form";
import { DraftDiscardButton } from "@/components/draft-discard-button";
import { DraftSubmitButton } from "@/components/draft-submit-button";
import { ClientCompanyFields } from "@/components/client-company-fields";
import { QuoteClientProjectFields } from "@/components/quote-client-project-fields";
import { QuoteCostingComposer } from "@/components/quote-costing-composer";
import { formDraftStorageKey, serializeFormDraft } from "@/lib/domain/form-draft";
import { formSubmissionAttemptStorageKey } from "@/lib/domain/form-submission-attempt";

/**
 * 실제 Coreloom 앱은 Next.js App Router 안에서 돌아가고, `<form action>`이 던진(리다이렉트가
 * 아닌) 에러는 항상 그 라우트 세그먼트의 에러 바운더리가 받는다(레이아웃까지 통째로 사라지지
 * 않는다). 이 프로젝트에는 아직 커스텀 error.tsx가 없지만, Next 자체가 프레임워크 차원의
 * 바운더리를 둔다 — 순수 unit 렌더에는 그게 없으니 최소한의 바운더리로 그 자리를 흉내 낸다.
 * 이게 없으면 저장 실패 시나리오가 "이 화면(패널)에 값이 남아 있나"가 아니라 "테스트 러너가
 * 안 죽나"만 재게 된다.
 */
class RouteSegmentErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <p role="alert">UX-SYNTHETIC-SAVE-FAILURE-SCREEN</p>;
    return this.props.children;
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis.crypto, "subtle", { configurable: true, value: webcrypto.subtle });
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const SCOPE = "UX-SYNTHETIC-SCOPE-1";
const QUOTE_SUBMISSION_FIELDS = [
  "quoteId", "clientId", "projectId", "clientContactId", "title", "note",
  "packagesJson", "vatMode", "targetMarginPercent", "operatingCostPercent",
  "issuedOn", "validUntil",
] as const;

// ---- 고객사 폼 헬퍼 -----------------------------------------------------

function renderClientFormElement(action: (formData: FormData) => void | Promise<void>) {
  return (
    <DraftAwareForm action={action} formId="client-create" scopeId={SCOPE}>
      <ClientCompanyFields includeFirstContact />
      <button type="submit">고객사 저장</button>
    </DraftAwareForm>
  );
}

function renderClientForm(action: (formData: FormData) => void | Promise<void>) {
  return render(renderClientFormElement(action));
}

function fillClientForm() {
  fireEvent.change(screen.getByPlaceholderText("예: 주식회사 예시"), {
    target: { value: "UX-SYNTHETIC-CLIENT-이름" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "과세 유형" }), {
    target: { value: "simplified" },
  });
}

function expectClientFormFilled() {
  expect((screen.getByPlaceholderText("예: 주식회사 예시") as HTMLInputElement).value).toBe(
    "UX-SYNTHETIC-CLIENT-이름",
  );
  expect((screen.getByRole("combobox", { name: "과세 유형" }) as HTMLSelectElement).value).toBe("simplified");
}

// ---- 견적 폼 헬퍼 --------------------------------------------------------

const QUOTE_CLIENTS = [
  { id: "UX-SYNTHETIC-CLIENT-A", name: "가상 고객사 A" },
  { id: "UX-SYNTHETIC-CLIENT-B", name: "가상 고객사 B" },
];
const QUOTE_PROJECTS = [
  { id: "UX-SYNTHETIC-PROJECT-A", name: "가상 프로젝트 A", clientCompanyId: "UX-SYNTHETIC-CLIENT-A" },
];

function renderQuoteFormElement(
  action: (formData: FormData) => void | Promise<void>,
  initialTab?: "customer" | "internal",
  scopeId = SCOPE,
  includeDiscard = false,
) {
  return (
    <DraftAwareForm
      action={action}
      formId="quote-create"
      persistentSubmissionFields={QUOTE_SUBMISSION_FIELDS}
      submissionRecoveryHref="/quotes"
      scopeId={scopeId}
    >
      <QuoteClientProjectFields clients={QUOTE_CLIENTS} projects={QUOTE_PROJECTS} />
      <QuoteCostingComposer clientName="가상 고객사 A" initialTab={initialTab} versionNumber={1} />
      {includeDiscard ? <DraftDiscardButton /> : null}
      <DraftSubmitButton>견적 저장</DraftSubmitButton>
    </DraftAwareForm>
  );
}

function submissionIdFrom(action: ReturnType<typeof vi.fn>, callIndex = 0) {
  return String((action.mock.calls[callIndex][0] as FormData).get("submissionId"));
}

function renderQuoteForm(
  action: (formData: FormData) => void | Promise<void>,
  initialTab?: "customer" | "internal",
) {
  return render(renderQuoteFormElement(action, initialTab));
}

function quotePackageArticles(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(".quote-package"));
}

function fillPackage(
  article: HTMLElement,
  values: {
    title: string;
    role: string;
    monthlyRate: string;
    months: string;
    headcount: string;
    utilizationPercent: string;
    quantity: string;
    amount: string;
    customerDescription: string;
  },
) {
  fireEvent.change(within(article).getByLabelText("작업명"), { target: { value: values.title } });
  fireEvent.change(within(article).getByLabelText("역할 / 등급"), { target: { value: values.role } });
  fireEvent.change(within(article).getByLabelText("단가"), { target: { value: values.monthlyRate } });
  fireEvent.change(within(article).getByLabelText("개월"), { target: { value: values.months } });
  fireEvent.change(within(article).getByLabelText("인원"), { target: { value: values.headcount } });
  fireEvent.change(within(article).getByLabelText("가동률"), {
    target: { value: values.utilizationPercent },
  });
  fireEvent.change(within(article).getByLabelText("고객 문서 수량"), { target: { value: values.quantity } });
  fireEvent.change(within(article).getByLabelText("공급가"), { target: { value: values.amount } });
  fireEvent.change(within(article).getByPlaceholderText("고객 견적서에만 보이는 설명"), {
    target: { value: values.customerDescription },
  });
}

function packagesFromSubmissionMirror(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[name="packagesJson"]');
  return JSON.parse(input?.value ?? "[]") as Array<Record<string, unknown>>;
}

function fillQuoteForm() {
  // 문자열 + 선택
  fireEvent.change(screen.getByRole("combobox", { name: "고객사" }), {
    target: { value: "UX-SYNTHETIC-CLIENT-B" },
  });
  fireEvent.change(screen.getByLabelText("견적 주제"), {
    target: { value: "UX-SYNTHETIC-견적-주제" },
  });
  // 날짜
  fireEvent.change(screen.getByLabelText("발행일"), { target: { value: "2026-09-10" } });
  // 품목/수량/단가 — 내부 원가 탭으로 전환해야 보인다
  fireEvent.click(screen.getByRole("tab", { name: "내부 원가 · 편집" }));
  fireEvent.change(screen.getByPlaceholderText("작업 패키지 1"), {
    target: { value: "UX-SYNTHETIC-작업명" },
  });
  fireEvent.change(screen.getByLabelText("고객 문서 수량"), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("단가"), { target: { value: "1234500" } });
  fireEvent.change(screen.getByPlaceholderText("고객 견적서에만 보이는 설명"), {
    target: { value: "UX-SYNTHETIC-PDF-DESCRIPTION" },
  });
  fireEvent.change(screen.getByPlaceholderText("견적 조건이나 전달 메모"), {
    target: { value: "UX-SYNTHETIC-NOTE" },
  });
}

async function expectQuoteFormFilled() {
  expect((screen.getByRole("combobox", { name: "고객사" }) as HTMLSelectElement).value).toBe(
    "UX-SYNTHETIC-CLIENT-B",
  );
  expect((screen.getByLabelText("견적 주제") as HTMLInputElement).value).toBe("UX-SYNTHETIC-견적-주제");
  expect((screen.getByLabelText("발행일") as HTMLInputElement).value).toBe("2026-09-10");
  // 품목 편집기는 "내부 원가" 탭에서만 DOM에 나타난다. 탭을 연 직후 값을 채우는 것은
  // MutationObserver 콜백(마이크로태스크)이라 한 틱 기다려야 한다 — 실제 사용자도
  // 탭을 열고 그 다음 프레임에 값을 보게 되는 것과 같다.
  fireEvent.click(screen.getByRole("tab", { name: "내부 원가 · 편집" }));
  await waitFor(() => {
    expect((screen.getByPlaceholderText("작업 패키지 1") as HTMLInputElement).value).toBe(
      "UX-SYNTHETIC-작업명",
    );
    expect((screen.getByPlaceholderText("고객 견적서에만 보이는 설명") as HTMLTextAreaElement).value).toBe(
      "UX-SYNTHETIC-PDF-DESCRIPTION",
    );
    expect((screen.getByPlaceholderText("견적 조건이나 전달 메모") as HTMLTextAreaElement).value).toBe(
      "UX-SYNTHETIC-NOTE",
    );
  });
  expect((screen.getByLabelText("고객 문서 수량") as HTMLInputElement).value).toBe("7");
  expect((screen.getByLabelText("단가") as HTMLInputElement).value).toBe("1,234,500");
}

describe("F02-01 PC 8조합 — 고객사 폼", () => {
  it("닫기→재열기: unmount 후 같은 scope/form으로 다시 mount해도 값이 남는다", () => {
    const { unmount } = renderClientForm(vi.fn());
    fillClientForm();
    unmount();
    renderClientForm(vi.fn());
    expectClientFormFilled();
  });

  it("새로고침: 컴포넌트를 버리고 새 렌더로 mount해도 sessionStorage에서 복원된다", () => {
    const { unmount } = renderClientForm(vi.fn());
    fillClientForm();
    unmount();
    cleanup();
    renderClientForm(vi.fn());
    expectClientFormFilled();
  });

  it("다른 화면 이동→복귀: 다른 formId를 열었다 원래 폼으로 돌아와도 값이 남는다", () => {
    const { unmount: unmountClient } = renderClientForm(vi.fn());
    fillClientForm();
    unmountClient();

    const { unmount: unmountOther } = render(
      <DraftAwareForm action={vi.fn()} formId="quote-inline-client-create" scopeId={SCOPE}>
        <ClientCompanyFields />
      </DraftAwareForm>,
    );
    unmountOther();

    renderClientForm(vi.fn());
    expectClientFormFilled();
  });

  it("다품목 저장 실패 후 재열기·재제출에서 전체 제출값이 같고 성공하면 초안을 지운다", async () => {
    const savedSubmissionIds = new Set<string>();
    let fakeSaveCount = 0;
    const fakeSave = (data: FormData) => {
      const submissionId = String(data.get("submissionId"));
      if (!savedSubmissionIds.has(submissionId)) {
        savedSubmissionIds.add(submissionId);
        fakeSaveCount += 1;
      }
    };
    const failingAction = vi.fn<(data: FormData) => Promise<void>>(async (data) => {
      fakeSave(data);
      throw new Error("UX-SYNTHETIC-RESPONSE-LOSS");
    });
    const first = render(
      <RouteSegmentErrorBoundary>{renderQuoteFormElement(failingAction)}</RouteSegmentErrorBoundary>,
    );
    fillQuoteForm();
    fireEvent.click(screen.getByText("패키지 추가"));
    fillPackage(quotePackageArticles(first.container)[1], {
      title: "UX-SYNTHETIC-SECOND",
      role: "PM",
      monthlyRate: "200000",
      months: "2",
      headcount: "1.5",
      utilizationPercent: "70",
      quantity: "3",
      amount: "876543",
      customerDescription: "UX-SYNTHETIC-SECOND-DESCRIPTION",
    });
    fireEvent.change(screen.getByLabelText("목표 마진"), { target: { value: "45" } });
    fireEvent.change(screen.getByLabelText("운영비"), { target: { value: "25" } });
    fireEvent.click(screen.getByText("견적 저장"));
    await screen.findByRole("alert");
    expect(failingAction).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(formDraftStorageKey(SCOPE, "quote-create"))).not.toBeNull();
    const failedPayload = Object.fromEntries(failingAction.mock.calls[0][0].entries());
    first.unmount();

    const successfulRetry = vi.fn<(data: FormData) => Promise<void>>(async (data) => fakeSave(data));
    const restored = renderQuoteForm(successfulRetry, "internal");
    await waitFor(() => {
      expect(quotePackageArticles(restored.container)).toHaveLength(2);
      expect((screen.getByLabelText("목표 마진") as HTMLInputElement).value).toBe("45");
      expect((screen.getByLabelText("운영비") as HTMLInputElement).value).toBe("25");
    });
    fireEvent.click(screen.getByRole("tab", { name: "고객용 · 미리보기" }));
    fireEvent.click(screen.getByText("견적 저장"));
    await waitFor(() => expect(successfulRetry).toHaveBeenCalledTimes(1));
    const retryPayload = Object.fromEntries(successfulRetry.mock.calls[0][0].entries());
    // Compare every field consumed by saveQuoteVersionAction, including the whole
    // collection and the identity that lets the server return the first save
    // instead of creating a duplicate after an ambiguous response loss.
    const submittedFields = [
      "quoteId", "clientId", "projectId", "clientContactId", "title", "note",
      "packagesJson", "vatMode", "targetMarginPercent", "operatingCostPercent",
      "issuedOn", "validUntil",
    ];
    for (const field of submittedFields) expect(retryPayload[field], field).toEqual(failedPayload[field]);
    expect(retryPayload.submissionId).toBe(failedPayload.submissionId);
    expect(fakeSaveCount).toBe(1);
    await waitFor(() => expect(sessionStorage.getItem(formDraftStorageKey(SCOPE, "quote-create"))).toBeNull());
  });

  it("저장 실패→복구: action이 실패해도 초안이 남고 재열기에 복원된다", async () => {
    // 진짜 앱은 Next App Router 라우트 세그먼트 안이라, 리다이렉트가 아닌 액션 에러는
    // 그 세그먼트의 에러 화면으로 바뀐다(패널이 그대로 떠 있는 게 아니다). 그래서 "같은
    // 화면에 값이 그대로 보이는지"가 아니라 "그 사이에도 초안이 sessionStorage에 남아
    // 있어서, 재열기(에러 화면에서 돌아와 패널을 다시 여는 것)에 복원되는지"를 잰다.
    const failingAction = vi.fn().mockRejectedValue(new Error("UX-SYNTHETIC-SAVE-FAILURE"));
    const { unmount } = render(
      <RouteSegmentErrorBoundary>{renderClientFormElement(failingAction)}</RouteSegmentErrorBoundary>,
    );
    fillClientForm();

    fireEvent.click(screen.getByText("고객사 저장"));
    await screen.findByRole("alert");
    expect(failingAction).toHaveBeenCalled();

    // 재열기에 남아 있는지 (에러 화면에서 돌아와 패널을 다시 연 것과 같다)
    unmount();
    renderClientForm(vi.fn());
    expectClientFormFilled();
  });
});

describe("F02-01 PC 8조합 — 견적 폼", () => {
  it("닫기→재열기: unmount 후 같은 scope/form으로 다시 mount해도 값이 남는다", async () => {
    const { unmount } = renderQuoteForm(vi.fn());
    fillQuoteForm();
    unmount();
    renderQuoteForm(vi.fn());
    await expectQuoteFormFilled();
  });

  it("새로고침: 컴포넌트를 버리고 새 렌더로 mount해도 sessionStorage에서 복원된다", async () => {
    const { unmount } = renderQuoteForm(vi.fn());
    fillQuoteForm();
    unmount();
    cleanup();
    renderQuoteForm(vi.fn());
    await expectQuoteFormFilled();
  });

  it("연속 재마운트: 첫 복원이 저장된 초안을 부분값으로 덮어쓰지 않는다", async () => {
    const first = renderQuoteForm(vi.fn());
    fillQuoteForm();
    first.unmount();

    const second = renderQuoteForm(vi.fn());
    await expectQuoteFormFilled();
    second.unmount();

    renderQuoteForm(vi.fn());
    await expectQuoteFormFilled();
  });

  it("동적 패키지의 전체 값과 순서를 복원하고 중간·첫 삭제 및 빈 추가를 즉시 보존한다", async () => {
    const first = renderQuoteForm(vi.fn());
    fireEvent.click(screen.getByRole("tab", { name: "내부 원가 · 편집" }));

    fillPackage(quotePackageArticles(first.container)[0], {
      title: "A",
      role: "PM",
      monthlyRate: "100000",
      months: "2",
      headcount: "3",
      utilizationPercent: "40",
      quantity: "2",
      amount: "765432",
      customerDescription: "A 설명",
    });
    fireEvent.click(screen.getByText("패키지 추가"));
    fillPackage(quotePackageArticles(first.container)[1], {
      title: "B",
      role: "기획",
      monthlyRate: "200000",
      months: "4",
      headcount: "1.5",
      utilizationPercent: "55",
      quantity: "3",
      amount: "876543",
      customerDescription: "B 설명",
    });
    fireEvent.click(screen.getByText("패키지 추가"));
    fillPackage(quotePackageArticles(first.container)[2], {
      title: "C",
      role: "리드 개발",
      monthlyRate: "300000",
      months: "6",
      headcount: "2",
      utilizationPercent: "70",
      quantity: "4",
      amount: "987654",
      customerDescription: "C 설명",
    });
    // 추가 직후 다른 입력 없이 닫아도 빈 패키지 자체가 초안에 남아야 한다.
    fireEvent.click(screen.getByText("패키지 추가"));
    first.unmount();

    const second = renderQuoteForm(vi.fn());
    await waitFor(() => expect(packagesFromSubmissionMirror(second.container)).toHaveLength(4));
    expect(packagesFromSubmissionMirror(second.container)).toMatchObject([
      {
        title: "A",
        role: "PM",
        monthlyRate: 100000,
        months: 2,
        headcount: 3,
        utilizationPercent: 40,
        quantity: 2,
        amount: 765432,
        amountLocked: true,
        customerDescription: "A 설명",
      },
      {
        title: "B",
        role: "기획",
        monthlyRate: 200000,
        months: 4,
        headcount: 1.5,
        utilizationPercent: 55,
        quantity: 3,
        amount: 876543,
        amountLocked: true,
        customerDescription: "B 설명",
      },
      {
        title: "C",
        role: "리드 개발",
        monthlyRate: 300000,
        months: 6,
        headcount: 2,
        utilizationPercent: 70,
        quantity: 4,
        amount: 987654,
        amountLocked: true,
        customerDescription: "C 설명",
      },
      { title: "", customerDescription: "", quantity: 1, amountLocked: false },
    ]);

    fireEvent.click(screen.getByRole("tab", { name: "내부 원가 · 편집" }));
    const secondPackages = quotePackageArticles(second.container);
    fireEvent.click(secondPackages[1].querySelector<HTMLButtonElement>(".quote-package-toggle")!);
    fireEvent.click(within(secondPackages[1]).getByText("패키지 삭제"));
    second.unmount();

    const third = renderQuoteForm(vi.fn());
    await waitFor(() => expect(packagesFromSubmissionMirror(third.container).map((pkg) => pkg.title)).toEqual(["A", "C", ""]));
    fireEvent.click(screen.getByRole("tab", { name: "내부 원가 · 편집" }));
    fireEvent.click(within(quotePackageArticles(third.container)[0]).getByText("패키지 삭제"));
    third.unmount();

    const fourth = renderQuoteForm(vi.fn());
    await waitFor(() => expect(packagesFromSubmissionMirror(fourth.container).map((pkg) => pkg.title)).toEqual(["C", ""]));
    expect(packagesFromSubmissionMirror(fourth.container)[0]).toMatchObject({
      title: "C",
      monthlyRate: 300000,
      months: 6,
      headcount: 2,
      utilizationPercent: 70,
      quantity: 4,
      amount: 987654,
      amountLocked: true,
      customerDescription: "C 설명",
    });
  });

  it("내부 편집 탭의 연속 복원에서도 수동 금액 잠금과 비기본 마진·운영비를 유지한다", async () => {
    const first = renderQuoteForm(vi.fn(), "internal");
    fireEvent.change(screen.getByLabelText("목표 마진"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("운영비"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("단가"), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("공급가"), { target: { value: "777777" } });
    fireEvent.click(screen.getByText("패키지 추가"));
    first.unmount();

    const second = renderQuoteForm(vi.fn(), "internal");
    await waitFor(() => {
      expect((screen.getByLabelText("목표 마진") as HTMLInputElement).value).toBe("1");
      expect((screen.getByLabelText("운영비") as HTMLInputElement).value).toBe("1");
      expect(packagesFromSubmissionMirror(second.container)[0]).toMatchObject({
        monthlyRate: 100000,
        amount: 777777,
        amountLocked: true,
      });
      expect(packagesFromSubmissionMirror(second.container)[1]).toMatchObject({
        title: "",
        amount: 6121212,
        amountLocked: false,
      });
    });
    second.unmount();

    const third = renderQuoteForm(vi.fn(), "internal");
    await waitFor(() => {
      expect((screen.getByLabelText("목표 마진") as HTMLInputElement).value).toBe("1");
      expect((screen.getByLabelText("운영비") as HTMLInputElement).value).toBe("1");
      expect(packagesFromSubmissionMirror(third.container)[0]).toMatchObject({
        monthlyRate: 100000,
        amount: 777777,
        amountLocked: true,
      });
      expect(packagesFromSubmissionMirror(third.container)[1]).toMatchObject({
        title: "",
        amount: 6121212,
        amountLocked: false,
      });
    });
  });

  it("손상된 패키지 컬렉션 초안은 기본 패키지 제출값을 오염시키지 않는다", async () => {
    sessionStorage.setItem(
      formDraftStorageKey(SCOPE, "quote-create"),
      serializeFormDraft({
        scopeId: SCOPE,
        formId: "quote-create",
        fields: { packagesJson: "{not-valid-json" },
      }),
    );

    const view = renderQuoteForm(vi.fn(), "internal");
    await waitFor(() => {
      const packages = packagesFromSubmissionMirror(view.container);
      expect(packages).toHaveLength(1);
      expect(packages[0]).toMatchObject({ title: "", quantity: 1, amountLocked: false });
    });
  });

  it("다른 화면 이동→복귀: 다른 formId를 열었다 원래 폼으로 돌아와도 값이 남는다", async () => {
    const { unmount: unmountQuote } = renderQuoteForm(vi.fn());
    fillQuoteForm();
    unmountQuote();

    const { unmount: unmountOther } = render(
      <DraftAwareForm action={vi.fn()} formId="quote-inline-client-create" scopeId={SCOPE}>
        <ClientCompanyFields />
      </DraftAwareForm>,
    );
    unmountOther();

    renderQuoteForm(vi.fn());
    await expectQuoteFormFilled();
  });

  it("저장 실패→복구: action이 실패해도 초안이 남고 재열기에 복원된다", async () => {
    // 고객사 폼과 같은 이유로(위 주석 참고) 같은 화면 생존이 아니라 재열기 복원을 잰다.
    const failingAction = vi.fn().mockRejectedValue(new Error("UX-SYNTHETIC-SAVE-FAILURE"));
    const { unmount } = render(
      <RouteSegmentErrorBoundary>{renderQuoteFormElement(failingAction)}</RouteSegmentErrorBoundary>,
    );
    fillQuoteForm();

    fireEvent.click(screen.getByText("견적 저장"));
    await screen.findByRole("alert");
    expect(failingAction).toHaveBeenCalled();

    unmount();
    renderQuoteForm(vi.fn());
    await expectQuoteFormFilled();
  });
});

describe("신규 견적의 응답 유실 재시도 식별자", () => {
  it("action 응답 유실은 같은 폼의 입력과 시도를 남기고 명시적 재시도로 성공한다", async () => {
    const action = vi.fn()
      .mockRejectedValueOnce(new Error("UX-SYNTHETIC-RESPONSE-LOSS"))
      .mockResolvedValueOnce(undefined);
    render(<RouteSegmentErrorBoundary>{renderQuoteFormElement(action)}</RouteSegmentErrorBoundary>);
    fireEvent.change(screen.getByLabelText("견적 주제"), { target: { value: "같은 화면 보존 제목" } });
    fireEvent.change(screen.getByRole("combobox", { name: "프로젝트 (선택)" }), {
      target: { value: "UX-SYNTHETIC-PROJECT-A" },
    });
    fireEvent.click(screen.getByText("견적 저장"));

    const notice = await screen.findByRole("alert");
    expect(within(notice).getByRole("heading", { name: "저장 여부를 확인해 주세요" })).toBeTruthy();
    expect(document.activeElement).toBe(notice);
    expect((screen.getByLabelText("견적 주제") as HTMLInputElement).value).toBe("같은 화면 보존 제목");
    expect((screen.getByRole("combobox", { name: "프로젝트 (선택)" }) as HTMLSelectElement).value).toBe(
      "UX-SYNTHETIC-PROJECT-A",
    );
    expect(screen.getByRole("link", { name: "견적 목록 확인" }).getAttribute("href")).toBe("/quotes");
    expect(sessionStorage.getItem(formDraftStorageKey(SCOPE, "quote-create"))).not.toBeNull();
    expect(sessionStorage.getItem(formSubmissionAttemptStorageKey(SCOPE, "quote-create"))).not.toBeNull();
    const failedPayload = Object.fromEntries((action.mock.calls[0][0] as FormData).entries());

    fireEvent.click(within(notice).getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    const retryPayload = Object.fromEntries((action.mock.calls[1][0] as FormData).entries());
    expect(retryPayload.submissionId).toBe(failedPayload.submissionId);
    for (const field of QUOTE_SUBMISSION_FIELDS) expect(retryPayload[field], field).toEqual(failedPayload[field]);
    await waitFor(() => {
      expect(sessionStorage.getItem(formDraftStorageKey(SCOPE, "quote-create"))).toBeNull();
      expect(sessionStorage.getItem(formSubmissionAttemptStorageKey(SCOPE, "quote-create"))).toBeNull();
    });
  });

  it("미확정 시도가 있으면 재열기 직후 확인·재시도 안내를 보여준다", async () => {
    const failedAction = vi.fn().mockRejectedValue(new Error("UX-SYNTHETIC-RESPONSE-LOSS"));
    const first = render(<RouteSegmentErrorBoundary>{renderQuoteFormElement(failedAction)}</RouteSegmentErrorBoundary>);
    fireEvent.change(screen.getByLabelText("견적 주제"), { target: { value: "재열기 안내 제목" } });
    fireEvent.click(screen.getByText("견적 저장"));
    await screen.findByRole("heading", { name: "저장 여부를 확인해 주세요" });
    first.unmount();

    renderQuoteForm(vi.fn());
    const reopenedNotice = await screen.findByRole("alert");
    expect(within(reopenedNotice).getByRole("heading", { name: "저장 여부를 확인해 주세요" })).toBeTruthy();
    expect(within(reopenedNotice).getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(within(reopenedNotice).getByRole("link", { name: "견적 목록 확인" }).getAttribute("href")).toBe("/quotes");
    expect((screen.getByLabelText("견적 주제") as HTMLInputElement).value).toBe("재열기 안내 제목");
  });

  it("확인되지 않은 저장 뒤 payload를 바꾸면 action 전에 막고 입력을 유지한다", async () => {
    const failedAction = vi.fn().mockRejectedValue(new Error("UX-SYNTHETIC-RESPONSE-LOSS"));
    const first = render(
      <RouteSegmentErrorBoundary>{renderQuoteFormElement(failedAction)}</RouteSegmentErrorBoundary>,
    );
    fireEvent.change(screen.getByLabelText("견적 주제"), { target: { value: "응답 유실 전 제목" } });
    fireEvent.click(screen.getByText("견적 저장"));
    await screen.findByRole("alert");
    first.unmount();

    const retryAction = vi.fn();
    renderQuoteForm(retryAction);
    await waitFor(() => {
      expect((screen.getByLabelText("견적 주제") as HTMLInputElement).value).toBe("응답 유실 전 제목");
    });
    fireEvent.change(screen.getByLabelText("견적 주제"), { target: { value: "바뀐 제목" } });
    fireEvent.click(screen.getByText("견적 저장"));

    await screen.findByText(
      "이전 요청과 내용이 달라 다시 보내지 않았습니다. 견적 목록에서 저장 여부를 먼저 확인해 주세요.",
    );
    expect(retryAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(screen.getByRole("link", { name: "견적 목록 확인" }).getAttribute("href")).toBe("/quotes");
    expect((screen.getByLabelText("견적 주제") as HTMLInputElement).value).toBe("바뀐 제목");
  });

  it("sessionStorage에 식별자를 확정하지 못하면 action 전에 막고 입력을 유지한다", async () => {
    const action = vi.fn();
    renderQuoteForm(action);
    const storageFailure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    fireEvent.change(screen.getByLabelText("견적 주제"), { target: { value: "보존할 제목" } });
    fireEvent.click(screen.getByText("견적 저장"));

    const notice = await screen.findByRole("alert");
    expect(within(notice).getByRole("heading", { name: "저장 요청을 보내지 못했습니다" })).toBeTruthy();
    expect(within(notice).getByRole("button", { name: "다시 시도" })).toBeTruthy();
    expect(within(notice).getByRole("link", { name: "견적 목록 확인" }).getAttribute("href")).toBe("/quotes");
    expect(action).not.toHaveBeenCalled();
    expect((screen.getByLabelText("견적 주제") as HTMLInputElement).value).toBe("보존할 제목");
    storageFailure.mockRestore();
  });

  it("action 진행 중 연타와 초안 버리기를 막고 완료 뒤에만 시도를 정리한다", async () => {
    let finishAction!: () => void;
    const actionGate = new Promise<void>((resolve) => {
      finishAction = resolve;
    });
    const action = vi.fn(() => actionGate);
    render(renderQuoteFormElement(action, undefined, SCOPE, true));
    fireEvent.change(screen.getByLabelText("견적 주제"), { target: { value: "진행 중 보존 제목" } });
    expect(screen.getByText("이 초안 버리기")).toBeTruthy();
    const saveButton = screen.getByRole("button", { name: "견적 저장" });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("이 초안 버리기")).toBeNull();
    expect(sessionStorage.getItem(formSubmissionAttemptStorageKey(SCOPE, "quote-create"))).not.toBeNull();

    fireEvent.click(saveButton);
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => finishAction());
    await waitFor(() => {
      expect(sessionStorage.getItem(formDraftStorageKey(SCOPE, "quote-create"))).toBeNull();
      expect(sessionStorage.getItem(formSubmissionAttemptStorageKey(SCOPE, "quote-create"))).toBeNull();
    });
  });

  it("성공 redirect는 복구 안내로 삼키지 않고 시도와 초안을 정리한 뒤 다시 던진다", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/quotes;303;",
    });
    const action = vi.fn().mockRejectedValue(redirectError);
    render(<RouteSegmentErrorBoundary>{renderQuoteFormElement(action)}</RouteSegmentErrorBoundary>);
    fireEvent.change(screen.getByLabelText("견적 주제"), { target: { value: "redirect 제목" } });
    fireEvent.click(screen.getByText("견적 저장"));

    await screen.findByText("UX-SYNTHETIC-SAVE-FAILURE-SCREEN");
    expect(screen.queryByRole("heading", { name: "저장 여부를 확인해 주세요" })).toBeNull();
    expect(sessionStorage.getItem(formDraftStorageKey(SCOPE, "quote-create"))).toBeNull();
    expect(sessionStorage.getItem(formSubmissionAttemptStorageKey(SCOPE, "quote-create"))).toBeNull();
  });

  it("다른 scope의 신규 견적은 확인되지 않은 시도의 식별자를 공유하지 않는다", async () => {
    const failedAction = vi.fn().mockRejectedValue(new Error("UX-SYNTHETIC-RESPONSE-LOSS"));
    const first = render(
      <RouteSegmentErrorBoundary>{renderQuoteFormElement(failedAction)}</RouteSegmentErrorBoundary>,
    );
    fireEvent.click(screen.getByText("견적 저장"));
    await screen.findByRole("alert");
    const firstId = submissionIdFrom(failedAction);
    first.unmount();

    const otherScopeAction = vi.fn();
    render(renderQuoteFormElement(otherScopeAction, undefined, "UX-SYNTHETIC-SCOPE-2"));
    fireEvent.click(screen.getByText("견적 저장"));
    await waitFor(() => expect(otherScopeAction).toHaveBeenCalledTimes(1));

    expect(submissionIdFrom(otherScopeAction)).not.toBe(firstId);
  });

  it("성공한 저장 다음 제출에는 새 UUID를 쓴다", async () => {
    const action = vi.fn();
    renderQuoteForm(action);
    fireEvent.click(screen.getByText("견적 저장"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "견적 저장" }).closest("form")?.getAttribute("aria-busy")).toBe("false");
    });
    fireEvent.click(screen.getByText("견적 저장"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));

    const firstId = submissionIdFrom(action, 0);
    const secondId = submissionIdFrom(action, 1);
    expect(firstId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(secondId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(secondId).not.toBe(firstId);
  });

  it("초안을 버린 뒤에는 확인되지 않은 시도를 지우고 새 UUID를 쓴다", async () => {
    const failedAction = vi.fn().mockRejectedValue(new Error("UX-SYNTHETIC-RESPONSE-LOSS"));
    const first = render(
      <RouteSegmentErrorBoundary>{renderQuoteFormElement(failedAction)}</RouteSegmentErrorBoundary>,
    );
    fireEvent.click(screen.getByText("견적 저장"));
    await screen.findByRole("alert");
    const failedId = submissionIdFrom(failedAction);
    first.unmount();

    const afterDiscardAction = vi.fn();
    render(renderQuoteFormElement(afterDiscardAction, undefined, SCOPE, true));
    fireEvent.click(await screen.findByText("이 초안 버리기"));
    fireEvent.click(screen.getByText("정말 버릴까요"));
    fireEvent.click(screen.getByText("견적 저장"));
    await waitFor(() => expect(afterDiscardAction).toHaveBeenCalledTimes(1));

    expect(submissionIdFrom(afterDiscardAction)).not.toBe(failedId);
  });

  it("해시 대기 중 초안을 버리면 늦게 식별자를 쓰거나 제출하지 않는다", async () => {
    const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let releaseDigest!: () => void;
    const digestGate = new Promise<void>((resolve) => {
      releaseDigest = resolve;
    });
    let delayedDigest!: Promise<ArrayBuffer>;
    const digestSpy = vi.spyOn(globalThis.crypto.subtle, "digest").mockImplementationOnce((algorithm, data) => {
      delayedDigest = digestGate.then(() => originalDigest(algorithm, data));
      return delayedDigest;
    });
    const action = vi.fn();
    render(renderQuoteFormElement(action, undefined, SCOPE, true));
    fireEvent.change(screen.getByLabelText("견적 주제"), { target: { value: "해시 중 버릴 제목" } });
    fireEvent.click(screen.getByText("견적 저장"));
    await waitFor(() => expect(digestSpy).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("이 초안 버리기"));
    fireEvent.click(screen.getByText("정말 버릴까요"));

    await act(async () => {
      releaseDigest();
      await delayedDigest;
    });
    expect(sessionStorage.getItem(formSubmissionAttemptStorageKey(SCOPE, "quote-create"))).toBeNull();
    expect(action).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("견적 저장"));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(submissionIdFrom(action)).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("해시 대기 중 폼을 닫으면 늦게 식별자를 쓰거나 제출하지 않는다", async () => {
    const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    let releaseDigest!: () => void;
    const digestGate = new Promise<void>((resolve) => {
      releaseDigest = resolve;
    });
    let delayedDigest!: Promise<ArrayBuffer>;
    const digestSpy = vi.spyOn(globalThis.crypto.subtle, "digest").mockImplementationOnce((algorithm, data) => {
      delayedDigest = digestGate.then(() => originalDigest(algorithm, data));
      return delayedDigest;
    });
    const staleAction = vi.fn();
    const first = renderQuoteForm(staleAction);
    fireEvent.click(screen.getByText("견적 저장"));
    await waitFor(() => expect(digestSpy).toHaveBeenCalledTimes(1));
    first.unmount();

    await act(async () => {
      releaseDigest();
      await delayedDigest;
    });
    expect(sessionStorage.getItem(formSubmissionAttemptStorageKey(SCOPE, "quote-create"))).toBeNull();
    expect(staleAction).not.toHaveBeenCalled();

    const newAction = vi.fn();
    renderQuoteForm(newAction);
    fireEvent.click(screen.getByText("견적 저장"));
    await waitFor(() => expect(newAction).toHaveBeenCalledTimes(1));
    expect(submissionIdFrom(newAction)).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("제출 이름과 복원 표식은 겹치지 않는다 (F02-01 회귀 방어)", () => {
  /*
   * 복원이 화면 칸을 찾으려고 그 칸에 제출용 `name`을 달았던 적이 있다. 그러면 같은 이름이
   * hidden과 화면 칸 두 곳에 생겨 FormData에 값이 두 개 들어간다. `formData.get()`은 앞의 것을
   * 읽어 당장은 멀쩡해 보이지만, 나중에 누가 `Object.fromEntries`로 바꾸면 뒤의 값이 이겨
   * 조용히 다른 값이 저장된다(견적 제목은 앞뒤 값이 실제로 다르다).
   * 복원은 `data-draft-field`로 찾고, 제출은 `name`으로 간다. 둘을 겹치지 않게 둔다.
   */
  it("견적 폼에서 같은 제출 이름이 두 번 나오지 않는다", () => {
    const { container } = renderQuoteForm(() => {});
    const names = Array.from(container.querySelectorAll<HTMLElement>("[name]"))
      .map((element) => element.getAttribute("name")!)
      // 품목 편집기는 같은 이름을 여러 줄에 의도적으로 반복한다(itemDescription 등 배열 입력).
      .filter((name) => !name.startsWith("item"));
    const duplicated = names.filter((name, index) => names.indexOf(name) !== index);
    expect([...new Set(duplicated)], "제출 이름이 겹치면 FormData에 값이 두 개 실린다").toEqual([]);
  });

  it("복원 표식이 붙은 칸에는 제출 이름이 없다", () => {
    const { container } = renderQuoteForm(() => {});
    const leaked = Array.from(container.querySelectorAll<HTMLElement>("[data-draft-field]"))
      .filter((element) => element.hasAttribute("name"))
      .map((element) => element.getAttribute("data-draft-field")!);
    // vatMode와 packagesJson은 예외다. 전자는 바깥 제어 여부에 따라, 후자는 컬렉션 전체를
    // 복원해야 해서 그 한 요소가 제출과 복원을 함께 맡는다. 같은 이름의 두 요소를 만들지는 않는다.
    expect(
      leaked.filter(
        (name) =>
          name !== "vatMode" &&
          name !== "packagesJson" &&
          name !== "targetMarginPercent" &&
          name !== "operatingCostPercent",
      ),
    ).toEqual([]);
  });
});
