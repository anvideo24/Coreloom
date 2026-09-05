// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ManualSystemMap } from "./manual-system-map";
import type { SystemMapNode } from "@/lib/domain/manual-system-map";

afterEach(() => cleanup());

const nodes: SystemMapNode[] = ["records", "files", "ai", "external", "manual"].map((id) => ({
  id, label: id, summary: `${id} 요약`, title: `${id} 상세`, route: `${id} 경로`, details: [`${id} 출처 1`, `${id} 출처 2`],
}));

describe("ManualSystemMap", () => {
  it("renders all five controls with AI selected by default", () => {
    render(<ManualSystemMap nodes={nodes} />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "ai ai 요약" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "ai 상세" })).toBeInTheDocument();
  });

  it("switches to one detail and closes it when selecting the active node", () => {
    render(<ManualSystemMap nodes={nodes} />);
    for (const node of nodes) {
      const button = screen.getByRole("button", { name: `${node.label} ${node.summary}` });
      fireEvent.click(button);
      expect(screen.getByRole("region", { name: `${node.title}` })).toBeInTheDocument();
      expect(screen.getAllByRole("region")).toHaveLength(1);
      fireEvent.click(button);
      expect(screen.queryByRole("region", { name: node.title })).not.toBeInTheDocument();
    }
  });

  it("keeps detail source text accessible for the selected node", () => {
    render(<ManualSystemMap nodes={nodes} />);
    const detail = screen.getByRole("region", { name: "ai 상세" });
    expect(within(detail).getByText("ai 출처 1")).toBeInTheDocument();
    expect(within(detail).getByText("ai 출처 2")).toBeInTheDocument();
  });
});
