"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { createRevenueEntryAction, createVentureAction } from "@/app/(private)/revenue/actions";
import { CreateIconButton } from "@/components/create-icon-button";
import { CreatePanel } from "@/components/create-panel";
import {
  revenueAccountCategories,
  revenueAccountCategoryLabels,
  revenueEntryStatusLabels,
  UNCLASSIFIED_LABEL,
  ventureKindLabels,
  ventureKinds,
  type RevenueEntryStatus,
  type VentureKind,
} from "@/lib/domain/revenue";

type Project = { id: string; name: string; clientName: string };
type Venture = { id: string; name: string; kind: VentureKind };
type RevenueRow = {
  id: string;
  href: string;
  sourceLabel: string;
  counterparty: string;
  status: RevenueEntryStatus;
  settlementDate: string;
  title: string;
  amount: number;
};
type Summary = {
  confirmedAmount: number;
  scheduledAmount: number;
  refundedAmount: number;
  unclassifiedCount: number;
};

type PanelMode = "entry" | "venture" | null;

export function RevenuePageClient({
  ventures,
  projects,
  rows,
  summary,
}: {
  ventures: Venture[];
  projects: Project[];
  rows: RevenueRow[];
  summary: Summary;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<PanelMode>(null);

  useEffect(() => {
    const next = searchParams.get("new");
    if (next === "1") setMode("entry");
    else if (next === "venture") setMode("venture");
    else setMode(null);
  }, [searchParams]);

  const close = useCallback(() => {
    setMode(null);
    if (searchParams.get("new")) router.replace(pathname);
  }, [pathname, router, searchParams]);

  const openEntry = useCallback(() => {
    setMode("entry");
    router.replace(`${pathname}?new=1`);
  }, [pathname, router]);

  const openVenture = useCallback(() => {
    setMode("venture");
    router.replace(`${pathname}?new=venture`);
  }, [pathname, router]);

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / REVENUE</p>
          <h1>매출 원장</h1>
          <p>
            고객사 프로젝트 청구와 앱·구독 매출을 한 목록에서 봅니다. 금액은 통화·발생일·정산일·확정 상태를 함께 가지며,
            연결하지 못한 건은 미분류로 표시합니다. 확정된 매출에 대해 환불을 등록하면 원래 금액을 덮어쓰지 않고 별도 환불
            이력으로 남깁니다. 비용은 비용 원장에서 따로 봅니다. 결제 채널 자동 수집과 세금계산서는 이 기능에 포함되지
            않습니다.
          </p>
        </div>
        <div className="quote-header-links">
          <CreateIconButton label="매출 등록" onClick={openEntry} />
          <CreateIconButton className="create-icon-button-secondary" label="사업 등록" onClick={openVenture} />
        </div>
      </header>

      <section aria-label="매출 원장" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">원장</p>
            <h2>고객사 프로젝트와 앱·구독</h2>
          </div>
          <span>{rows.length}건</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>
              표시할 매출이 없습니다. 청구 입금 또는 앱·구독 매출을 등록하면 이 목록에 모입니다. 합계 0원은 만들지
              않습니다.
            </p>
            <button className="auth-submit" onClick={openEntry} type="button">
              매출 등록
            </button>
          </div>
        ) : (
          <>
            <p className="form-help">
              확정 {summary.confirmedAmount.toLocaleString("ko-KR")}원 · 예정{" "}
              {summary.scheduledAmount.toLocaleString("ko-KR")}원
              {summary.refundedAmount > 0 ? ` · 환불 ${summary.refundedAmount.toLocaleString("ko-KR")}원` : ""} ·{" "}
              {UNCLASSIFIED_LABEL} {summary.unclassifiedCount}건
            </p>
            {rows.map((row) => (
              <a className="quote-row" href={row.href} key={row.id}>
                <div>
                  <p>
                    {row.sourceLabel} · {row.counterparty} · {revenueEntryStatusLabels[row.status]} · 정산{" "}
                    {row.settlementDate}
                  </p>
                  <h3>{row.title}</h3>
                </div>
                <strong>{row.amount.toLocaleString("ko-KR")}원</strong>
              </a>
            ))}
          </>
        )}
      </section>

      <CreatePanel onClose={close} open={mode === "entry"} size="wide" title="매출 등록">
        <form action={createRevenueEntryAction} className="quote-form">
          <p className="setup-code quote-form-full">연결</p>
          <p className="form-help quote-form-full">
            프로젝트와 사업을 동시에 고르지 마세요. 둘 다 비우면 미분류입니다. 계정과목은 선택입니다. 증빙 파일은
            문서함에서 연결합니다.
          </p>
          <label>
            고객사 프로젝트 (선택)
            <select defaultValue="" name="projectId">
              <option value="">연결 안 함</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.clientName} · {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            앱·구독 사업 (선택)
            <select defaultValue="" name="ventureId">
              <option value="">연결 안 함</option>
              {ventures.map((venture) => (
                <option key={venture.id} value={venture.id}>
                  {ventureKindLabels[venture.kind]} · {venture.name}
                </option>
              ))}
            </select>
          </label>

          <p className="setup-code quote-form-full">금액</p>
          <label>
            계정과목 (선택)
            <select defaultValue="" name="accountCategory">
              <option value="">미정</option>
              {revenueAccountCategories.map((category) => (
                <option key={category} value={category}>
                  {revenueAccountCategoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            금액 (원)
            <input min={1} name="amount" required step={1} type="number" />
          </label>
          <label>
            발생일
            <input name="occurredOn" required type="date" />
          </label>
          <label>
            정산일
            <input name="settlementDate" required type="date" />
          </label>
          <label>
            메모 (선택)
            <input name="note" />
          </label>
          <button className="auth-submit" type="submit">
            매출 저장
          </button>
        </form>
      </CreatePanel>

      <CreatePanel onClose={close} open={mode === "venture"} size="wide" title="사업 등록">
        <form action={createVentureAction} className="quote-form">
          <p className="setup-code quote-form-full">앱·구독 사업</p>
          <label className="quote-form-full">
            사업명
            <input name="name" placeholder="예: 구독 서비스" required />
          </label>
          <label>
            종류
            <select defaultValue="app" name="kind">
              {ventureKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {ventureKindLabels[kind]}
                </option>
              ))}
            </select>
          </label>
          <button className="auth-submit" type="submit">
            사업 저장
          </button>
        </form>
      </CreatePanel>
    </>
  );
}
