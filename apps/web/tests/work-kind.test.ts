import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildFounderDashboard } from "@/lib/domain/dashboard";
import {
  normalizeTaskDraft,
  normalizeTaskLink,
  taskLinkLabel,
  type WorkKind,
} from "@/lib/domain/tasks";

/**
 * F06 — 업무를 회사 운영·자체 사업·고객사 프로젝트 세 유형으로 담는 서버·화면 규칙을 잰다.
 * 서버·DB에 접근할 수 없어(작업 규칙) 두 가지로 재현한다.
 *  1) `normalizeTaskLink`·`taskLinkLabel` — 실제 도메인 함수를 그대로 부른다.
 *  2) 가상 저장소(`createVirtualTaskRepository`) — `src/lib/tasks/repository.ts`의
 *     `createFounderTask`가 하는 워크스페이스 범위 검사(프로젝트·사업이 같은 워크스페이스인지)를
 *     배열로 흉내 낸다. Postgres에는 전혀 접근하지 않는다.
 */

type VirtualProject = { id: string; workspaceId: string; clientCompanyId: string; deletedAt: string | null };
type VirtualVenture = { id: string; workspaceId: string; deletedAt: string | null };
type VirtualTask = {
  id: string;
  workspaceId: string;
  kind: WorkKind;
  projectId: string | null;
  clientCompanyId: string | null;
  ventureId: string | null;
  title: string;
  dueDate: string;
  completionCondition: string;
};

/**
 * `src/lib/tasks/repository.ts`의 `createFounderTask`를 흉내 낸 가상 저장소다.
 * 실제 쿼리 대신 `Array.find`로 `workspaceId` 일치까지 확인해, "남의 워크스페이스 프로젝트·사업
 * id를 넣으면 거부한다"는 그 함수의 핵심 동작을 DB 없이 재현한다.
 */
function createVirtualTaskRepository() {
  const projects: VirtualProject[] = [];
  const ventures: VirtualVenture[] = [];
  const store: VirtualTask[] = [];
  let seq = 0;

  return {
    seedProject(project: VirtualProject) {
      projects.push(project);
    },
    seedVenture(venture: VirtualVenture) {
      ventures.push(venture);
    },
    createTask(
      workspaceId: string,
      input: { kind: string; projectId?: string; ventureId?: string; title: string; dueDate: string; completionCondition: string },
    ) {
      // src/lib/tasks/repository.ts의 createFounderTask와 같은 순서다: 고객사 프로젝트 업무는
      // clientCompanyId를 프로젝트에서 끌어와야 해서, 프로젝트·사업을 워크스페이스 범위로 먼저
      // 찾은 뒤에야 normalizeTaskLink로 최종 모양을 확정한다.
      const rawKind = input.kind.trim();
      let projectId: string | null = null;
      let clientCompanyId: string | null = null;
      let ventureId: string | null = null;

      if (rawKind === "client") {
        const rawProjectId = input.projectId?.trim() || "";
        const project = rawProjectId
          ? projects.find((row) => row.id === rawProjectId && row.workspaceId === workspaceId && !row.deletedAt)
          : undefined;
        if (!project) throw new Error("Project was not found");
        projectId = project.id;
        clientCompanyId = project.clientCompanyId;
      } else if (rawKind === "internal") {
        const rawVentureId = input.ventureId?.trim() || "";
        const venture = rawVentureId
          ? ventures.find((row) => row.id === rawVentureId && row.workspaceId === workspaceId && !row.deletedAt)
          : undefined;
        if (!venture) throw new Error("Venture was not found");
        ventureId = venture.id;
      }

      const link = normalizeTaskLink({ kind: rawKind, projectId, clientCompanyId, ventureId });
      const draft = normalizeTaskDraft(input);
      const task: VirtualTask = {
        id: `task-${seq++}`,
        workspaceId,
        kind: link.kind,
        projectId: link.projectId,
        clientCompanyId: link.clientCompanyId,
        ventureId: link.ventureId,
        ...draft,
      };
      store.push(task);
      return task;
    },
    findTask(id: string) {
      return store.find((row) => row.id === id) ?? null;
    },
  };
}

describe("F06-01 · 세 유형 업무 등록·재조회 3/3", () => {
  it("creates and rereads company, internal, and client tasks with matching links", () => {
    const repo = createVirtualTaskRepository();
    repo.seedProject({ id: "proj-1", workspaceId: "ws-1", clientCompanyId: "client-1", deletedAt: null });
    repo.seedVenture({ id: "venture-1", workspaceId: "ws-1", deletedAt: null });

    const created = [
      repo.createTask("ws-1", {
        kind: "client",
        projectId: "proj-1",
        title: "고객사 초안 전달",
        dueDate: "2026-09-10",
        completionCondition: "고객사가 확인한다",
      }),
      repo.createTask("ws-1", {
        kind: "internal",
        ventureId: "venture-1",
        title: "자체 앱 다음 판 준비",
        dueDate: "2026-09-11",
        completionCondition: "출시 체크리스트를 채운다",
      }),
      repo.createTask("ws-1", {
        kind: "company",
        title: "사업자등록 서류 준비",
        dueDate: "2026-09-12",
        completionCondition: "서류를 제출한다",
      }),
    ];

    const reread = created.map((task) => repo.findTask(task.id));
    expect(reread.every((task) => task !== null)).toBe(true); // 3/3

    expect(reread[0]).toMatchObject({
      kind: "client",
      projectId: "proj-1",
      clientCompanyId: "client-1",
      ventureId: null,
      title: "고객사 초안 전달",
    });
    expect(reread[1]).toMatchObject({
      kind: "internal",
      projectId: null,
      clientCompanyId: null,
      ventureId: "venture-1",
      title: "자체 앱 다음 판 준비",
    });
    expect(reread[2]).toMatchObject({
      kind: "company",
      projectId: null,
      clientCompanyId: null,
      ventureId: null,
      title: "사업자등록 서류 준비",
    });

    // 고객사 없는 유형(자체 사업·회사 운영)에서 가짜 고객사를 만들지 않았다.
    expect(reread[1]!.clientCompanyId).toBeNull();
    expect(reread[2]!.clientCompanyId).toBeNull();
  });

  it("keeps taskLinkLabel readable for all three kinds without inventing names", () => {
    expect(taskLinkLabel({ kind: "client", clientName: "고객A", projectName: "사이트" })).toBe("고객A · 사이트");
    expect(taskLinkLabel({ kind: "internal", ventureName: "우리 앱" })).toBe("우리 앱");
    expect(taskLinkLabel({ kind: "company" })).toBe("회사 운영");
  });
});

describe("F06-02 · 잘못된 유형 간 연결·무권한 조회 0건 (음성 사례 4개)", () => {
  it("1) rejects a project attached to a company-operations task", () => {
    expect(() => normalizeTaskLink({ kind: "company", projectId: "proj-1" })).toThrow(
      "회사 운영 업무에는 프로젝트·고객사·사업을 붙일 수 없습니다.",
    );
  });

  it("2) rejects a client company attached to an internal-venture task", () => {
    expect(() => normalizeTaskLink({ kind: "internal", ventureId: "venture-1", clientCompanyId: "client-1" })).toThrow(
      "자체 사업 업무에는 프로젝트·고객사를 붙일 수 없습니다.",
    );
  });

  it("3) rejects a client-project task with no project", () => {
    expect(() => normalizeTaskLink({ kind: "client", clientCompanyId: "client-1" })).toThrow(
      "고객사 프로젝트 업무는 프로젝트와 고객사가 있어야 합니다.",
    );
  });

  it("4) rejects a venture id that belongs to another workspace", () => {
    const repo = createVirtualTaskRepository();
    repo.seedVenture({ id: "venture-99", workspaceId: "ws-OTHER", deletedAt: null });

    expect(() =>
      repo.createTask("ws-1", {
        kind: "internal",
        ventureId: "venture-99",
        title: "남의 사업에 붙이기 시도",
        dueDate: "2026-09-10",
        completionCondition: "확인",
      }),
    ).toThrow("Venture was not found");
  });
});

describe("F06 · 기존 업무는 client 유형으로 남는다(기본값)", () => {
  // DB에 접근할 수 없어 마이그레이션·스키마 원문에 기본값이 실제로 박혀 있는지를 정적으로 확인한다.
  // `ADD COLUMN ... DEFAULT 'client' NOT NULL`은 Postgres가 이미 있는 행에도 그 값을 채운다는 뜻이다.
  it("declares DEFAULT 'client' in the hand-written migration", () => {
    const migrationPath = join(__dirname, "..", "drizzle", "0032_work_kind_and_venture_tasks.sql");
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/ADD COLUMN "kind" "work_kind" DEFAULT 'client' NOT NULL/);
  });

  it("declares .default(\"client\") on the tasks.kind column in schema.ts", () => {
    const schemaPath = join(__dirname, "..", "src", "lib", "db", "schema.ts");
    const schema = readFileSync(schemaPath, "utf8");
    expect(schema).toMatch(/kind: workKind\("kind"\)\.notNull\(\)\.default\("client"\)/);
  });
});

describe("F06 · 대시보드가 회사 운영·자체 사업 업무를 프로젝트 카드에 안 붙인다", () => {
  const empty = {
    quotes: [],
    contracts: [],
    billings: [],
    pendingProposals: [],
    projects: [],
    revenue: { confirmedAmount: 0, scheduledAmount: 0, unclassifiedCount: 0 },
    expenses: [],
    tasks: [],
    recentDecisions: [],
    documentCount: 0,
  };

  it("leaves the project card without a next action when only company/venture tasks exist", () => {
    const dashboard = buildFounderDashboard({
      ...empty,
      today: "2026-09-05",
      setupItems: [],
      projects: [{ id: "pr1", name: "고객 프로젝트", clientName: "고객A", status: "active", progressPercent: 10 }],
      tasks: [
        {
          id: "t1",
          title: "사업자등록 서류 준비",
          dueDate: "2026-09-05",
          status: "open",
          kind: "company",
          clientName: null,
          projectName: null,
          ventureName: null,
          projectId: null,
        },
        {
          id: "t2",
          title: "자체 앱 다음 판 준비",
          dueDate: "2026-09-05",
          status: "open",
          kind: "internal",
          clientName: null,
          projectName: null,
          ventureName: "우리 앱",
          projectId: null,
        },
      ],
    });

    // F05-03이 이름 매칭을 projectId 매칭으로 고쳤다 — 프로젝트 id가 없는 회사·사업 업무는
    // 어느 프로젝트 카드의 "다음 행동"으로도 안 붙어야 한다.
    expect(dashboard.projectCards[0]).toMatchObject({ title: "고객 프로젝트", nextAction: "다음 할 일이 없습니다" });

    // 그렇다고 업무 자체가 사라지진 않는다 — 일정·수신함에는 자기 유형 이름으로 나온다.
    expect(dashboard.schedule.map((item) => item.detail)).toEqual([
      expect.stringContaining("회사 운영"),
      expect.stringContaining("우리 앱"),
    ]);
    expect(dashboard.inbox.some((item) => item.title === "사업자등록 서류 준비")).toBe(true);
    expect(dashboard.inbox.some((item) => item.title === "자체 앱 다음 판 준비")).toBe(true);
  });
});
