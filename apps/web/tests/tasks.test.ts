import { describe, expect, it } from "vitest";

import { completeTask, groupOpenTasksByDueDate, normalizeTaskDraft } from "@/lib/domain/tasks";

describe("task drafts", () => {
  it("keeps a title, due date, and completion condition", () => {
    expect(normalizeTaskDraft({
      title: " 화면 초안 전달 ",
      dueDate: "2026-09-12",
      completionCondition: " 고객사가 초안을 확인한다 ",
    })).toEqual({
      title: "화면 초안 전달",
      dueDate: "2026-09-12",
      completionCondition: "고객사가 초안을 확인한다",
    });
  });

  it("rejects a missing title, due date, or completion condition", () => {
    expect(() => normalizeTaskDraft({ title: " ", dueDate: "2026-09-12", completionCondition: "확인" })).toThrow("Task title is required");
    expect(() => normalizeTaskDraft({ title: "업무", dueDate: "09-12", completionCondition: "확인" })).toThrow("Due date is required");
    expect(() => normalizeTaskDraft({ title: "업무", dueDate: "2026-09-12", completionCondition: " " })).toThrow("Completion condition is required");
  });
});

describe("task completion", () => {
  it("requires representative approval on an open task", () => {
    expect(completeTask({ status: "open", approved: true })).toEqual({ status: "done" });
    expect(() => completeTask({ status: "open", approved: false })).toThrow("Representative approval is required");
    expect(() => completeTask({ status: "done", approved: true })).toThrow("Completed tasks cannot be changed");
  });
});

describe("task schedule", () => {
  it("groups open tasks by due date and skips completed tasks", () => {
    expect(groupOpenTasksByDueDate([
      { dueDate: "2026-09-12", status: "open", title: "나중" },
      { dueDate: "2026-09-10", status: "done", title: "끝난 일" },
      { dueDate: "2026-09-10", status: "open", title: "먼저" },
    ])).toEqual([
      { dueDate: "2026-09-10", tasks: [{ dueDate: "2026-09-10", status: "open", title: "먼저" }] },
      { dueDate: "2026-09-12", tasks: [{ dueDate: "2026-09-12", status: "open", title: "나중" }] },
    ]);
  });
});
