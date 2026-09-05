// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ManualWorkMap } from "./manual-work-map";
import type { WorkMapStep, WorkMapSupport } from "@/lib/domain/manual-work-map";

afterEach(() => cleanup());

const steps: WorkMapStep[] = ["고객사", "프로젝트", "견적", "계약", "청구", "입금 확인"].map((label, index) => ({
  id: ["client", "project", "quote", "contract", "billing", "receipt"][index], label, question: `${label} 질문`, purpose: `${label} 목적`, record: `${label} 기록`, relation: `${label} 연결`, caution: `${label} 주의`, href: index === 5 ? "/billings" : `/${["clients", "clients-projects", "quotes", "contracts", "billings"][index]}`, linkLabel: label,
}));
const supports: WorkMapSupport[] = ["회사 준비", "문서함", "업무", "AI 에이전트"].map((label, index) => ({ id: `support-${index}`, label, summary: `${label} 요약`, relation: `${label} 관계`, description: `${label} 설명`, href: `/support-${index}`, linkLabel: `${label} 열기` }));

describe("ManualWorkMap", () => {
  it("renders six collapsed flow controls and four support disclosures", () => {
    render(<ManualWorkMap steps={steps} supports={supports} />);
    expect(screen.getAllByRole("button")).toHaveLength(6);
    screen.getAllByRole("button").forEach((button) => expect(button).toHaveAttribute("aria-expanded", "false"));
    expect(screen.queryByRole("region", { name: /설명/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/요약$/)).toHaveLength(4);
  });

  it("toggles one explanation and closes it when selected again", () => {
    render(<ManualWorkMap steps={steps} supports={supports} />);
    const client = screen.getByRole("button", { name: /고객사/ });
    fireEvent.click(client);
    expect(client).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "고객사 설명" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /프로젝트/ }));
    expect(screen.getByRole("region", { name: "프로젝트 설명" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "고객사 설명" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /프로젝트/ }));
    expect(screen.queryByRole("region", { name: /설명/ })).not.toBeInTheDocument();
  });

  it("uses real internal links, including receipt linking to billings", () => {
    render(<ManualWorkMap steps={steps} supports={supports} />);
    fireEvent.click(screen.getByRole("button", { name: /입금 확인/ }));
    expect(within(screen.getByRole("region", { name: "입금 확인 설명" })).getByRole("link")).toHaveAttribute("href", "/billings");
    supports.forEach((support) => expect(screen.getByRole("link", { name: support.linkLabel })).toHaveAttribute("href", support.href));
  });
});
