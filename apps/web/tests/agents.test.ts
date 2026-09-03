import { describe, expect, it } from "vitest";

import {
  aiAgentAllowedWorkKinds,
  aiAgentForbiddenWorkKinds,
  agentAccessLabel,
  approveAiAgentWork,
  assertAgentCanRecordWork,
  assignTaskAgent,
  deactivateAiAgent,
  formatAllowedWork,
  isAgentAssignableToProject,
  normalizeAiAgentDraft,
  normalizeAiAgentWorkLog,
  normalizeAllowedWork,
  partitionAgentWorkLogs,
  rejectAiAgentWork,
} from "@/lib/domain/agents";

describe("ai agent drafts", () => {
  it("keeps a system account name, purpose, allowed work, and access scope", () => {
    expect(normalizeAiAgentDraft({
      name: " 초안 도우미 ",
      purpose: " 견적·계약 초안만 작성한다 ",
      allowedWork: ["draft", "research", "draft"],
      accessScope: " 이 프로젝트의 초안과 업무만 ",
      projectId: "project-1",
      ventureId: " ",
    })).toEqual({
      name: "초안 도우미",
      purpose: "견적·계약 초안만 작성한다",
      allowedWork: ["draft", "research"],
      accessScope: "이 프로젝트의 초안과 업무만",
      projectId: "project-1",
      ventureId: null,
      status: "active",
    });
  });

  it("rejects a missing name, purpose, access scope, or allowed work", () => {
    const valid = {
      name: "초안 도우미",
      purpose: "초안 작성",
      allowedWork: ["draft"],
      accessScope: "회사 공통 초안만",
    };
    expect(() => normalizeAiAgentDraft({ ...valid, name: " " })).toThrow("Agent name is required");
    expect(() => normalizeAiAgentDraft({ ...valid, purpose: " " })).toThrow("Agent purpose is required");
    expect(() => normalizeAiAgentDraft({ ...valid, accessScope: " " })).toThrow("Agent access scope is required");
    expect(() => normalizeAiAgentDraft({ ...valid, allowedWork: [] })).toThrow("Allowed work is required");
  });

  it("rejects a project and venture together", () => {
    expect(() => normalizeAiAgentDraft({
      name: "초안 도우미",
      purpose: "초안 작성",
      allowedWork: ["draft"],
      accessScope: "범위",
      projectId: "project-1",
      ventureId: "venture-1",
    })).toThrow("Link to a project or a venture, not both");
  });

  it("rejects forbidden or unknown allowed work", () => {
    expect(normalizeAllowedWork(["research", "approval_request"])).toEqual(["research", "approval_request"]);
    expect(() => normalizeAllowedWork(["expense_confirm"])).toThrow(
      "Agents cannot independently confirm money, contracts, permissions, or public publishing",
    );
    expect(() => normalizeAllowedWork(["contract_execute"])).toThrow(
      "Agents cannot independently confirm money, contracts, permissions, or public publishing",
    );
    expect(() => normalizeAllowedWork(["summarize"])).toThrow("Unsupported allowed work");
    expect(aiAgentAllowedWorkKinds).toEqual(["research", "draft", "task_update", "approval_request"]);
    expect(aiAgentForbiddenWorkKinds).toEqual([
      "expense_confirm",
      "contract_execute",
      "revenue_confirm",
      "refund",
      "permission_change",
      "public_publish",
    ]);
  });

  it("labels company, project, and venture access ranges", () => {
    expect(agentAccessLabel({ accessScope: "초안만" })).toBe("회사 공통 · 초안만");
    expect(agentAccessLabel({
      accessScope: "업무만",
      clientName: "고객A",
      projectName: "브랜드 사이트",
    })).toBe("고객A · 브랜드 사이트 · 업무만");
    expect(agentAccessLabel({ accessScope: "조사만", ventureName: "앱" })).toBe("앱 · 조사만");
    expect(formatAllowedWork(["draft", "research"])).toBe("초안 작성 · 자료 조사");
  });
});

describe("ai agent status and assignment", () => {
  it("deactivates an active agent once", () => {
    expect(deactivateAiAgent({ status: "active" })).toEqual({ status: "inactive" });
    expect(() => deactivateAiAgent({ status: "inactive" })).toThrow("Inactive agents cannot be changed");
  });

  it("assigns only an active project-scoped or company-wide agent to an open task", () => {
    expect(assignTaskAgent({
      status: "open",
      assignedAgentId: " agent-1 ",
      agentStatus: "active",
      agentProjectId: null,
      agentVentureId: null,
      taskProjectId: "project-1",
    })).toEqual({ assignedAgentId: "agent-1" });
    expect(assignTaskAgent({
      status: "open",
      assignedAgentId: "",
      taskProjectId: "project-1",
    })).toEqual({ assignedAgentId: null });
    expect(() => assignTaskAgent({
      status: "done",
      assignedAgentId: "agent-1",
      agentStatus: "active",
      taskProjectId: "project-1",
    })).toThrow("Completed tasks cannot be changed");
    expect(() => assignTaskAgent({
      status: "open",
      assignedAgentId: "agent-1",
      agentStatus: "inactive",
      taskProjectId: "project-1",
    })).toThrow("Inactive agents cannot be assigned");
    expect(() => assignTaskAgent({
      status: "open",
      assignedAgentId: "agent-1",
      agentStatus: "active",
      agentVentureId: "venture-1",
      taskProjectId: "project-1",
    })).toThrow("Venture-scoped agents cannot be assigned to project tasks");
    expect(() => assignTaskAgent({
      status: "open",
      assignedAgentId: "agent-1",
      agentStatus: "active",
      agentProjectId: "project-2",
      taskProjectId: "project-1",
    })).toThrow("Task is outside the agent access scope");
  });

  it("keeps venture-scoped agents off project task assignment", () => {
    expect(isAgentAssignableToProject({
      status: "active",
      projectId: null,
      ventureId: null,
    }, "project-1")).toBe(true);
    expect(isAgentAssignableToProject({
      status: "active",
      projectId: "project-1",
      ventureId: null,
    }, "project-1")).toBe(true);
    expect(isAgentAssignableToProject({
      status: "active",
      projectId: "project-2",
      ventureId: null,
    }, "project-1")).toBe(false);
    expect(isAgentAssignableToProject({
      status: "active",
      projectId: null,
      ventureId: "venture-1",
    }, "project-1")).toBe(false);
    expect(isAgentAssignableToProject({
      status: "inactive",
      projectId: null,
      ventureId: null,
    }, "project-1")).toBe(false);
  });
});

describe("ai agent work logs", () => {
  it("keeps a request, input, and optional result without a task", () => {
    expect(normalizeAiAgentWorkLog({
      requestNote: " 초안을 정리한다 ",
      inputNote: " 견적 항목 ",
      resultNote: " ",
      taskId: " ",
    })).toEqual({
      requestNote: "초안을 정리한다",
      inputNote: "견적 항목",
      resultNote: null,
      taskId: null,
    });
    expect(() => normalizeAiAgentWorkLog({ requestNote: " ", inputNote: "자료" })).toThrow("Work request is required");
    expect(() => normalizeAiAgentWorkLog({ requestNote: "요청", inputNote: " " })).toThrow("Work input is required");
  });

  it("blocks inactive or out-of-scope work recording", () => {
    expect(() => assertAgentCanRecordWork({
      agentStatus: "inactive",
      agentProjectId: null,
      agentVentureId: null,
    })).toThrow("Inactive agents cannot record work");
    expect(() => assertAgentCanRecordWork({
      agentStatus: "active",
      agentProjectId: null,
      agentVentureId: "venture-1",
      taskProjectId: "project-1",
    })).toThrow("Venture-scoped agents cannot record project task work");
    expect(() => assertAgentCanRecordWork({
      agentStatus: "active",
      agentProjectId: "project-2",
      agentVentureId: null,
      taskProjectId: "project-1",
    })).toThrow("Task is outside the agent access scope");
  });

  it("approves pending work only with a result and representative approval", () => {
    expect(approveAiAgentWork({
      status: "pending",
      approved: true,
      resultNote: " 초안 완료 ",
    })).toEqual({ status: "approved", resultNote: "초안 완료" });
    expect(() => approveAiAgentWork({ status: "pending", approved: false, resultNote: "초안 완료" }))
      .toThrow("Representative approval is required");
    expect(() => approveAiAgentWork({ status: "pending", approved: true, resultNote: " " }))
      .toThrow("Work result is required");
    expect(() => approveAiAgentWork({ status: "approved", approved: true, resultNote: "초안 완료" }))
      .toThrow("Decided agent work cannot be changed");
  });

  it("rejects pending work with a reason and does not require a result", () => {
    expect(rejectAiAgentWork({ status: "pending", approved: true, reason: " 범위 밖 " })).toEqual({
      status: "rejected",
      decisionReason: "범위 밖",
    });
    expect(() => rejectAiAgentWork({ status: "pending", approved: true, reason: " " })).toThrow("Rejection reason is required");
    expect(() => rejectAiAgentWork({ status: "rejected", approved: true, reason: "범위 밖" }))
      .toThrow("Decided agent work cannot be changed");
  });

  it("splits pending work from decided history", () => {
    expect(partitionAgentWorkLogs([
      { status: "approved", requestNote: "끝난 일" },
      { status: "pending", requestNote: "대기" },
      { status: "rejected", requestNote: "반려" },
    ])).toEqual({
      pending: [{ status: "pending", requestNote: "대기" }],
      decided: [
        { status: "approved", requestNote: "끝난 일" },
        { status: "rejected", requestNote: "반려" },
      ],
    });
  });
});
