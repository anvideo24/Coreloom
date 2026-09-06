// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApprovalReviewCard } from "@/components/approval-review-card";

afterEach(cleanup);

describe("ApprovalReviewCard", () => {
  it("puts subject and zero amount before recorded references and the outcome", () => {
    render(<ApprovalReviewCard summary={{
      subject: "가나다 프로젝트 · 계약",
      amountLabel: "KRW · 0원",
      evidenceLabel: "참고 경로 C:/private/very-long-folder/계약서/날인-원본.pdf",
      outcomeLabel: "계약 체결 — 버전 고정, 자동 실행 없음",
    }} />);

    expect(screen.getByRole("heading", { name: "확정 전 확인" })).toBeTruthy();
    expect(screen.getByText("대상")).toBeTruthy();
    expect(screen.getByText("KRW · 0원")).toBeTruthy();
    expect(screen.getByText("기록된 증빙·참고")).toBeTruthy();
    expect(screen.getByText("참고 경로 C:/private/very-long-folder/계약서/날인-원본.pdf")).toBeTruthy();
    expect(screen.getByText("확정 후 결과")).toBeTruthy();
    expect(screen.getByText("계약 체결 — 버전 고정, 자동 실행 없음")).toBeTruthy();
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(["대상", "금액", "기록된 증빙·참고", "확정 후 결과"]);
  });

  it("shows missing references and escapes markup without claiming verification", () => {
    const { container } = render(<ApprovalReviewCard summary={{
      subject: '<img src=x onerror="alert(1)">',
      amountLabel: "금액 없음",
      evidenceLabel: "증빙 없음",
      outcomeLabel: "작업 이력 승인 — 기록 고정, 자동 실행 없음",
    }} />);

    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("금액 없음")).toBeTruthy();
    expect(screen.getByText("증빙 없음")).toBeTruthy();
    expect(screen.getByText("작업 이력 승인 — 기록 고정, 자동 실행 없음")).toBeTruthy();
    expect(screen.getByText("기록된 값이며, 원본·입금·내용을 확인한 결과는 아닙니다.")).toBeTruthy();
    expect(screen.queryByText(/검증됨|확인됨/)).toBeNull();
  });
});
