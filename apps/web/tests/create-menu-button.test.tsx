/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateMenuButton } from "@/components/create-menu-button";

afterEach(() => {
  cleanup();
});

describe("CreateMenuButton", () => {
  it("shows one plus and opens labeled choices", () => {
    const onEntry = vi.fn();
    const onVenture = vi.fn();
    render(
      <CreateMenuButton
        label="새로 만들기"
        options={[
          { label: "매출 등록", onClick: onEntry },
          { label: "사업 등록", onClick: onVenture },
        ]}
      />,
    );

    expect(screen.queryByRole("menuitem", { name: "매출 등록" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "새로 만들기" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "사업 등록" }));
    expect(onVenture).toHaveBeenCalledTimes(1);
    expect(onEntry).not.toHaveBeenCalled();
    expect(screen.queryByRole("menuitem", { name: "사업 등록" })).toBeNull();
  });
});
