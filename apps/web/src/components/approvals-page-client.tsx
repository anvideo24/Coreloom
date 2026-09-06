"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  approvalKindLabels,
  type ApprovalInboxItem,
  type ApprovalKind,
} from "@/lib/domain/approvals";
import {
  approvalNavigationStorageKey,
  parseApprovalNavigation,
  restoreApprovalNavigation,
  serializeApprovalNavigation,
} from "@/lib/domain/approval-navigation";
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
  scopeId,
  summary,
}: {
  items: ApprovalInboxItem[];
  scopeId: string;
  summary: Summary;
}) {
  // 대표가 바뀌면 이전 대표의 React 상태까지 버린 새 탐색 맥락으로 시작한다.
  return <ApprovalsPageClientContent items={items} key={scopeId} scopeId={scopeId} summary={summary} />;
}

function ApprovalsPageClientContent({
  items,
  scopeId,
  summary,
}: {
  items: ApprovalInboxItem[];
  scopeId: string;
  summary: Summary;
}) {
  const [query, setQuery] = useState("");
  const [selectedKind, setSelectedKind] = useState<ApprovalKind | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  const [inspectedPosition, setInspectedPosition] = useState<number | null>(null);
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);
  const initialItems = useRef(items);
  const restoredItemRef = useRef<HTMLAnchorElement | null>(null);
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

  useEffect(() => {
    try {
      const saved = parseApprovalNavigation(window.sessionStorage.getItem(approvalNavigationStorageKey(scopeId)), scopeId);
      if (saved) {
        const restored = restoreApprovalNavigation(saved, initialItems.current);
        setQuery(restored.query);
        setSelectedKind(restored.selectedKind);
        if (restored.inspectedPosition !== null) {
          setInspectedItemId(saved.inspectedItemId ?? null);
          setInspectedPosition(restored.inspectedPosition);
          setScrollToItemId(saved.inspectedItemId ?? null);
        }
      }
    } catch {
      // 저장소가 막혔거나 고장 나도 승인함 조회는 그대로 쓴다.
    } finally {
      setIsRestored(true);
    }
  }, [scopeId]);

  useEffect(() => {
    if (!isRestored) return;
    try {
      window.sessionStorage.setItem(
        approvalNavigationStorageKey(scopeId),
        serializeApprovalNavigation({
          scopeId,
          query,
          selectedKind,
          ...(inspectedItemId ? { inspectedItemId } : {}),
          ...(inspectedPosition !== null ? { inspectedPosition } : {}),
        }),
      );
    } catch {
      // 비공개 모드 등의 저장소 제한은 탐색 자체를 막지 않는다.
    }
  }, [inspectedItemId, inspectedPosition, isRestored, query, scopeId, selectedKind]);

  useEffect(() => {
    if (!scrollToItemId || !restoredItemRef.current) return;
    restoredItemRef.current.scrollIntoView?.({ block: "center" });
    setScrollToItemId(null);
  }, [filteredItems, scrollToItemId]);

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
            ) : filteredItems.map((item, position) => {
              const whenLabel = item.when ? approvalWhenLabels[item.kind] : undefined;
              return (
                <Link
                  aria-label={`${item.title} 상세 검토`}
                  className={`quote-row ${styles.row}`}
                  href={item.href}
                  key={item.id}
                  onClick={() => {
                    try {
                      window.sessionStorage.setItem(
                        approvalNavigationStorageKey(scopeId),
                        serializeApprovalNavigation({
                          scopeId,
                          query,
                          selectedKind,
                          inspectedItemId: item.id,
                          inspectedPosition: position,
                        }),
                      );
                    } catch {
                      // 저장하지 못해도 기존 상세 이동은 막지 않는다.
                    }
                    setInspectedItemId(item.id);
                    setInspectedPosition(position);
                  }}
                  ref={item.id === scrollToItemId ? restoredItemRef : undefined}
                >
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
