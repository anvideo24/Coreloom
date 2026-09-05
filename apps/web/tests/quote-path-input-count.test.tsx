// @vitest-environment jsdom
/**
 * F01-03 실측 — "고객사 하나를 새로 만들고, 그 고객사로 품목 1개짜리 견적 초안을 저장한다"는
 * 같은 결과를 두 경로로 실제 컴포넌트를 렌더해 재현하고, 직접 입력 필드 수를 InputTally로 센다.
 *
 * 경로 A(기존 최소 경로): 고객사 화면(ClientsPageClient)에서 고객사를 만들고
 *   → 견적 화면(QuotesPageClient)으로 옮겨 → 견적 초안 작성.
 * 경로 B(새 경로): 견적 작성 중 QuotesPageClient 패널 안에서 고객사를 만들고
 *   → 그대로 이어서 견적 초안 작성(자동 리다이렉트로 복귀).
 *
 * 무엇을 세고 무엇을 뺐는지 (공통 측정 조건 4번 그대로):
 * - 센다: 사용자가 실제로 타이핑/선택한 칸만. 상호(텍스트), 견적의 고객사 select(필요할 때만),
 *   작업 패키지의 작업명(텍스트).
 * - 뺀다: packagesJson 등 hidden 필드, 단가·개월·인원·가동률·수량(안 건드려도 전부 양수 기본값이라
 *   원가 계산이 그대로 통과해 저장이 된다 — `createEmptyQuotePackage`의 기본값 참고), 발행일·
 *   유효기간(오늘 날짜로 이미 유효), 담당자·프로젝트(선택 사항), 부가세 모드(기본값이 이미 유효).
 *   이 칸들은 화면에는 보이지만 "채워야 저장되는 칸"이 아니므로 세지 않는다.
 * - 견적 패키지 제목은 서버 저장 자체에는 필수가 아니다(비워도 `title.trim()`이 빈 문자열로
 *   저장될 뿐, 원가 계산은 role/rate 기본값이 이미 양수라 통과한다). 그래도 "품목 1개"가 실제로
 *   식별 가능한 내용을 갖게 하려고 이 시험은 두 경로 모두 동일하게 이 칸을 채운다 — 두 경로에
 *   똑같이 적용되므로 A-B 비교에는 영향이 없다(같은 조건).
 *
 * 고객사 목록 정렬(결과에 실제로 영향을 준다): `listFounderQuotes`가 쓰는 실제 쿼리는
 * `orderBy(asc(clientCompanies.name))`다 — 새 고객사가 항상 목록 맨 앞에 오지 않는다. 이 시험은
 * 그 사실을 그대로 반영해 두 경로 모두에 기존 고객사 하나("UX-BASELINE-CLIENT", 새 고객사 이름보다
 * 알파벳순으로 앞선다)를 동일하게 미리 둔다. 고객사가 하나도 없는 "운 좋은" 조건으로 경로 A를
 * 유리하게(또는 불리하게) 만들지 않는다.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ClientsPageClient } from "@/components/clients-page-client";
import { QuotesPageClient } from "@/components/quotes-page-client";
import { quoteIssuerProfile } from "@/lib/quotes/issuer";
import {
  InputTally,
  listQuoteDraftMismatches,
  quotePathAfterInlineClientCreate,
  reductionRate,
  type QuoteDraftSnapshot,
} from "@/lib/domain/quote-client-flow";

// ---- next/navigation 모킹 ------------------------------------------------
// searchParams는 매 렌더 새 객체를 돌려주면 useEffect(deps=[searchParams])가 매번 "바뀐 것"으로
// 보고 재실행돼 open 상태를 계속 초기화해 버린다(에러 없이 조용히 패널이 닫힘). 그래서 값이 실제로
// 바뀔 때만 새 URLSearchParams를 만들고, 그 외에는 같은 참조를 돌려준다.
const nav = vi.hoisted(() => ({
  pathname: "/quotes",
  search: "",
  paramsCache: new URLSearchParams(""),
}));

function setNav(pathname: string, search: string) {
  nav.pathname = pathname;
  nav.search = search;
  nav.paramsCache = new URLSearchParams(search);
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.paramsCache,
}));

// ---- 서버 액션 모킹(DB 접근 없음, FormData만 가로챈다) --------------------
const createClientAction = vi.fn();
const createClientFromQuoteAction = vi.fn();
const saveQuoteVersionAction = vi.fn();

vi.mock("@/app/(private)/clients-projects/actions", () => ({
  createClientAction: (formData: FormData) => createClientAction(formData),
  createClientFromQuoteAction: (formData: FormData) => createClientFromQuoteAction(formData),
}));

vi.mock("@/app/(private)/quotes/actions", () => ({
  saveQuoteVersionAction: (formData: FormData) => saveQuoteVersionAction(formData),
}));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  setNav("/quotes", "");
});

afterEach(() => {
  cleanup();
});

// ---- 고정된 "동일 결과" 목표값 --------------------------------------------
const CLIENT_NAME = "UX-SYNTHETIC-CLIENT-F0103";
const ITEM_TITLE = "UX-SYNTHETIC-ITEM-F0103";
const BASELINE_CLIENT = { id: "existing-baseline", name: "UX-BASELINE-CLIENT" };

type ClientRow = React.ComponentProps<typeof ClientsPageClient>["clients"][number];

function baselineClientRow(): ClientRow {
  return {
    id: BASELINE_CLIENT.id,
    name: BASELINE_CLIENT.name,
    businessRegistrationNumber: null,
    representativeName: null,
    taxType: null,
    tradeKind: "sales",
    contactCount: 0,
    projectCount: 0,
  };
}

function quoteSnapshotFromFormData(formData: FormData): Omit<QuoteDraftSnapshot, "clientId" | "projectId"> {
  const packagesJson = String(formData.get("packagesJson") ?? "[]");
  const packages = JSON.parse(packagesJson) as Array<{ title: string; amount: number }>;
  return {
    clientName: CLIENT_NAME,
    title: String(formData.get("title") ?? ""),
    itemTitles: packages.map((pkg) => pkg.title.trim()),
    totalAmount: packages.reduce((sum, pkg) => sum + Number(pkg.amount || 0), 0),
  };
}

// ---- 경로 A: 고객사 화면 → 견적 화면 --------------------------------------

async function runPathA() {
  // 이 함수가 한 시험 안에서 runPathB와 함께(경로 비교용) 두 번 불릴 수 있으므로, 공유 mock의
  // 호출 횟수가 이전 경로 실행분과 섞이지 않게 매번 스스로 비운다.
  createClientAction.mockClear();
  createClientFromQuoteAction.mockClear();
  saveQuoteVersionAction.mockClear();
  const tally = new InputTally();

  // 화면 1: /clients
  setNav("/clients", "");
  let clientFormData: FormData | undefined;
  createClientAction.mockImplementationOnce(async (formData: FormData) => {
    clientFormData = formData;
  });

  const clientsScreen = render(
    <ClientsPageClient clients={[baselineClientRow()]} draftScopeId="UX-SYNTHETIC-SCOPE-A" />,
  );

  fireEvent.click(screen.getByRole("button", { name: "새 고객사" }));
  tally.recordTransition("panel", "A: /clients 화면에서 새 고객사 패널 열기");

  await waitFor(() => screen.getByPlaceholderText("예: 주식회사 예시"));
  fireEvent.change(screen.getByPlaceholderText("예: 주식회사 예시"), {
    target: { value: CLIENT_NAME },
  });
  tally.fillField("상호", "text");

  fireEvent.click(screen.getByText("고객사 저장"));
  await waitFor(() => expect(createClientAction).toHaveBeenCalledTimes(1));
  expect(clientFormData?.get("name")).toBe(CLIENT_NAME);

  clientsScreen.unmount();
  // 실제 앱은 createClientAction 성공 후 /clients/[id](상세)로 리다이렉트한다 — /quotes가 아니다.
  tally.recordTransition("page", "A: 고객사 저장 → /clients/[id] 상세로 서버 리다이렉트");

  // 화면 2: /quotes로 수동 이동(메뉴 클릭 등, 이 시험은 화면 상태 전환만 흉내 낸다)
  setNav("/quotes", "");
  tally.recordTransition("page", "A: /clients/[id]에서 /quotes로 수동 이동");

  const newClient = { id: "new-client-a", name: CLIENT_NAME };
  // 이름 오름차순 정렬이라 새 고객사가 목록 맨 앞에 오지 않는다(UX-BASELINE < UX-SYNTHETIC).
  const quotesClients = [{ id: BASELINE_CLIENT.id, name: BASELINE_CLIENT.name }, newClient];

  let quoteFormData: FormData | undefined;
  saveQuoteVersionAction.mockImplementationOnce(async (formData: FormData) => {
    quoteFormData = formData;
  });

  const quotesScreen = render(
    <QuotesPageClient
      clients={quotesClients}
      contacts={[]}
      draftScopeId="UX-SYNTHETIC-SCOPE-A"
      issuer={quoteIssuerProfile}
      projects={[]}
      versions={[]}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "새 견적" }));
  tally.recordTransition("panel", "A: /quotes 화면에서 새 견적 패널 열기");

  await waitFor(() => screen.getByRole("combobox", { name: "고객사" }));
  const clientSelect = screen.getByRole("combobox", { name: "고객사" }) as HTMLSelectElement;
  // 자동으로 새 고객사를 가리키지 않는다는 것을 먼저 확인한다 — 그래서 선택이 "직접 입력"이다.
  expect(clientSelect.value).toBe(BASELINE_CLIENT.id);
  fireEvent.change(clientSelect, { target: { value: newClient.id } });
  tally.fillField("고객사 선택", "select");

  fireEvent.click(screen.getByRole("tab", { name: "내부 원가" }));
  tally.recordTransition("tab", "A: 내부 원가 탭 전환(품목 칸 노출)");

  await waitFor(() => screen.getByPlaceholderText("작업 패키지 1"));
  fireEvent.change(screen.getByPlaceholderText("작업 패키지 1"), {
    target: { value: ITEM_TITLE },
  });
  tally.fillField("작업명", "text");

  fireEvent.click(screen.getByText("견적 버전 1 저장"));
  await waitFor(() => expect(saveQuoteVersionAction).toHaveBeenCalledTimes(1));

  quotesScreen.unmount();
  return { tally, clientFormData: clientFormData!, quoteFormData: quoteFormData! };
}

// ---- 경로 B: 견적 패널 안에서 고객사 등록 ----------------------------------

async function runPathB() {
  createClientAction.mockClear();
  createClientFromQuoteAction.mockClear();
  saveQuoteVersionAction.mockClear();
  const tally = new InputTally();

  setNav("/quotes", "");
  let clientFormData: FormData | undefined;
  createClientFromQuoteAction.mockImplementationOnce(async (formData: FormData) => {
    clientFormData = formData;
  });

  const firstScreen = render(
    <QuotesPageClient
      clients={[{ id: BASELINE_CLIENT.id, name: BASELINE_CLIENT.name }]}
      contacts={[]}
      draftScopeId="UX-SYNTHETIC-SCOPE-B"
      issuer={quoteIssuerProfile}
      projects={[]}
      versions={[]}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "새 견적" }));
  tally.recordTransition("panel", "B: /quotes 화면에서 새 견적 패널 열기");

  await waitFor(() => screen.getByRole("button", { name: "새 고객사 등록" }));
  fireEvent.click(screen.getByRole("button", { name: "새 고객사 등록" }));
  // 패널은 그대로 열려 있고 안의 내용만 바뀐다 — 새 페이지도 새 패널도 아니라서 "탭 전환"류(모드
  // 전환)로 분류한다. 페이지 이동·패널 개폐 어느 쪽으로도 세지 않는다는 점을 문서로 남긴다.
  tally.recordTransition("tab", "B: 같은 패널 안에서 고객사 등록 모드로 전환");

  await waitFor(() => screen.getByPlaceholderText("예: 주식회사 예시"));
  fireEvent.change(screen.getByPlaceholderText("예: 주식회사 예시"), {
    target: { value: CLIENT_NAME },
  });
  tally.fillField("상호", "text");

  fireEvent.click(screen.getByText("고객사 저장 후 견적 이어쓰기"));
  await waitFor(() => expect(createClientFromQuoteAction).toHaveBeenCalledTimes(1));
  expect(clientFormData?.get("name")).toBe(CLIENT_NAME);

  firstScreen.unmount();

  const newClient = { id: "new-client-b", name: CLIENT_NAME };
  const redirectPath = quotePathAfterInlineClientCreate(newClient.id);
  const [redirectPathname, redirectQuery] = redirectPath.split("?");
  setNav(redirectPathname, `?${redirectQuery}`);
  // 서버가 자동으로 돌려보낸다 — 사용자가 클릭해서 이동한 것이 아니다. 그래도 실제로 페이지가
  // 한 번 새로 로드되므로(리다이렉트) "페이지 이동"으로 센다. F01-02(왕복 0회)는 "직접 조작해야
  // 하는 왕복"이 0이라는 뜻이지, 페이지 전환 자체가 0이라는 뜻이 아니다 — 그 구분을 여기 남긴다.
  tally.recordTransition("page", `B: 서버가 자동으로 ${redirectPath}로 되돌림(사용자 클릭 없음)`);

  let quoteFormData: FormData | undefined;
  saveQuoteVersionAction.mockImplementationOnce(async (formData: FormData) => {
    quoteFormData = formData;
  });

  const secondScreen = render(
    <QuotesPageClient
      clients={[{ id: BASELINE_CLIENT.id, name: BASELINE_CLIENT.name }, newClient]}
      contacts={[]}
      draftScopeId="UX-SYNTHETIC-SCOPE-B"
      issuer={quoteIssuerProfile}
      projects={[]}
      versions={[]}
    />,
  );

  // clientId는 ?clientId= 쿼리로 자동 세팅된다 — 선택 조작이 필요 없다는 것을 확인한다.
  await waitFor(() => {
    expect((screen.getByRole("combobox", { name: "고객사" }) as HTMLSelectElement).value).toBe(newClient.id);
  });

  fireEvent.click(screen.getByRole("tab", { name: "내부 원가" }));
  tally.recordTransition("tab", "B: 내부 원가 탭 전환(품목 칸 노출)");

  await waitFor(() => screen.getByPlaceholderText("작업 패키지 1"));
  fireEvent.change(screen.getByPlaceholderText("작업 패키지 1"), {
    target: { value: ITEM_TITLE },
  });
  tally.fillField("작업명", "text");

  fireEvent.click(screen.getByText("견적 버전 1 저장"));
  await waitFor(() => expect(saveQuoteVersionAction).toHaveBeenCalledTimes(1));

  secondScreen.unmount();
  return { tally, clientFormData: clientFormData!, quoteFormData: quoteFormData! };
}

describe("F01-03: 직접 입력 필드 수 — 경로 A(기존 최소 경로) vs 경로 B(새 경로)", () => {
  it("경로 A: 상호 + 고객사 선택 + 작업명 = 3개 직접 입력, 반복 입력 0개", async () => {
    const { tally, clientFormData, quoteFormData } = await runPathA();
    expect(tally.fieldNames()).toEqual(["상호", "고객사 선택", "작업명"]);
    expect(tally.directFieldCount).toBe(3);
    expect(tally.repeatedFieldCount).toBe(0);
    expect(tally.transitionCounts()).toEqual({ page: 2, panel: 2, tab: 1, total: 5 });
    expect(clientFormData.get("name")).toBe(CLIENT_NAME);
    expect(quoteFormData.get("clientId")).toBe("new-client-a");
  });

  it("경로 B: 상호 + 작업명 = 2개 직접 입력(고객사 선택 불필요), 반복 입력 0개", async () => {
    const { tally, clientFormData, quoteFormData } = await runPathB();
    expect(tally.fieldNames()).toEqual(["상호", "작업명"]);
    expect(tally.directFieldCount).toBe(2);
    expect(tally.repeatedFieldCount).toBe(0);
    expect(tally.transitionCounts()).toEqual({ page: 1, panel: 1, tab: 2, total: 4 });
    expect(clientFormData.get("name")).toBe(CLIENT_NAME);
    expect(quoteFormData.get("clientId")).toBe("new-client-b");
  });

  it("두 경로의 결과물이 실제로 같다(같은 고객사 이름·같은 품목 제목·같은 금액)", async () => {
    const resultA = await runPathA();
    const resultB = await runPathB();

    expect(resultA.clientFormData.get("name")).toBe(resultB.clientFormData.get("name"));

    // clientId는 서버가 새로 발급한 값이라 경로마다 다른 게 정상이다(DB 기본키와 같은 성격).
    // "동일 결과"는 사람이 보는 내용(고객사 이름·품목 제목·금액)이 같은지로 판단한다 — 그래서
    // 비교용 스냅샷에는 자리표시자로 같은 clientId를 넣어 비교에서 의도적으로 제외한다.
    const snapshotA: QuoteDraftSnapshot = {
      clientId: "SAME-FOR-COMPARISON",
      projectId: null,
      ...quoteSnapshotFromFormData(resultA.quoteFormData),
    };
    const snapshotB: QuoteDraftSnapshot = {
      clientId: "SAME-FOR-COMPARISON",
      projectId: null,
      ...quoteSnapshotFromFormData(resultB.quoteFormData),
    };
    expect(listQuoteDraftMismatches(snapshotA, snapshotB)).toEqual([]);
    expect(snapshotA.itemTitles).toEqual([ITEM_TITLE]);
    expect(snapshotA.totalAmount).toBeGreaterThan(0);
  });

  it("F01-03 판정: 감소율 계산, 30% 목표 대비(미달이어도 그대로 보고한다)", async () => {
    const { tally: tallyA } = await runPathA();
    const { tally: tallyB } = await runPathB();
    const rate = reductionRate(tallyA.directFieldCount, tallyB.directFieldCount);
    // 측정값 고정: 3개 → 2개. (3-2)/3 ≈ 0.333.
    expect(rate).toBeCloseTo(1 / 3, 5);
    // 목표는 0.3 이상 감소다. 이 조건에서는 달성이지만, 판정을 이 시험이 임의로 강제하지 않는다 —
    // 값을 그대로 남기고, 사람이 읽는 보고에서 목표 대비 달성/미달을 적는다.
    const meetsGoal = rate >= 0.3;
    expect(meetsGoal).toBe(true);
  });
});
