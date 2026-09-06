"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  approvalKindLabels,
  type ApprovalInboxItem,
  type ApprovalKind,
} from "@/lib/domain/approvals";
import styles from "./approvals-page-client.module.css";

type Summary = {
  total: number;
  byKind: Record<ApprovalKind, number>;
};

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

const approvalGuides: Record<ApprovalKind, string> = {
  expense: "증빙·금액",
  revenue: "정산 근거·금액",
  billing: "실제 입금·청구 금액",
  contract: "날인 원본·계약 조건",
  proposal: "원문 근거·제안 내용",
  agent_work: "요청 내용·허용 업무",
};

const approvalWhenLabels: Partial<Record<ApprovalKind, string>> = {
  expense: "지급 예정",
  revenue: "정산일",
  billing: "입금 예정",
  agent_work: "요청일",
};

export function ApprovalsPageClient({
  items,
  summary,
}: {
  items: ApprovalInboxItem[];
  summary: Summary;
}) {
  const [query, setQuery] = useState("");
  const [selectedKind, setSelectedKind] = useState<ApprovalKind | null>(null);
  const kinds = Object.keys(approvalKindLabels) as ApprovalKind[];
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    return items.filter((item) => {
      const matchesKind = !selectedKind || item.kind === selectedKind;
      const matchesQuery = !normalizedQuery || [item.title, item.detail, item.kindLabel]
        .some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
      return matchesKind && matchesQuery;
    });
  }, [items, query, selectedKind]);
  const hasFilters = Boolean(selectedKind || query);

  function resetFilters() {
    setQuery("");
    setSelectedKind(null);
  }

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / APPROVALS</p>
          <h1>승인함</h1>
          <p>대상과 근거를 확인한 뒤, 각 상세 화면에서 결정하세요.</p>
          <p className={styles.readOnly}>이 화면은 조회만 합니다. 승인·반려는 여기서 하지 않습니다.</p>
        </div>
      </header>

      <section aria-label="승인 대기" className={`quote-list ${styles.inbox}`}>
        <div className="list-heading">
          <div>
            <p className="setup-code">대기</p>
            <h2>대표 승인</h2>
          </div>
          <span aria-live="polite">표시 {filteredItems.length}건 / 전체 {summary.total}건</span>
        </div>
        {items.length === 0 ? (
          <div className={`empty-state quote-empty-inline ${styles.empty}`}>
            <p>지금 승인할 항목이 없습니다.</p>
            <Link href="/dashboard">대시보드로 이동</Link>
          </div>
        ) : (
          <>
            <div className={styles.controls}>
              <label className={styles.search}>
                <span>승인 항목 검색</span>
                <input
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="제목 또는 표시된 내용 검색"
                  type="search"
                  value={query}
                />
              </label>
              <div aria-label="승인 종류 필터" className={styles.filters} role="group">
                <button aria-pressed={!selectedKind} onClick={() => setSelectedKind(null)} type="button">전체 {summary.total}건</button>
                {kinds.map((kind) => (
                  <button
                    aria-pressed={selectedKind === kind}
                    key={kind}
                    onClick={() => setSelectedKind(kind)}
                    type="button"
                  >
                    {approvalKindLabels[kind]} {summary.byKind[kind]}건
                  </button>
                ))}
              </div>
              {hasFilters && filteredItems.length > 0 ? <button className={styles.reset} onClick={resetFilters} type="button">필터 초기화</button> : null}
            </div>
            {filteredItems.length === 0 ? (
              <div className={`empty-state quote-empty-inline ${styles.empty}`}>
                <p>검색하거나 고른 분류에 맞는 항목이 없습니다.</p>
                <button onClick={resetFilters} type="button">필터 초기화</button>
              </div>
            ) : filteredItems.map((item) => {
              const whenLabel = item.when ? approvalWhenLabels[item.kind] : undefined;
              return (
                <Link aria-label={`${item.title} 상세 검토`} className={`quote-row ${styles.row}`} href={item.href} key={item.id}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowHeading}>
                      <h3>{item.title}</h3>
                      <span className={styles.kind}>{item.kindLabel}</span>
                    </div>
                    <p className="form-help">{item.detail}</p>
                    <p className={styles.guide}><span>상세에서 확인할 것</span> {approvalGuides[item.kind]}</p>
                  </div>
                  <div className={styles.rowMeta}>
                    {typeof item.amount === "number" ? <strong>{formatWon(item.amount)}</strong> : null}
                    {whenLabel ? <span>{whenLabel} {item.when}</span> : null}
                    <span className={styles.review}>상세 검토</span>
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </section>
    </>
  );
}
