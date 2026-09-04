"use client";

import Link from "next/link";

import {
  approvalKindLabels,
  type ApprovalInboxItem,
  type ApprovalKind,
} from "@/lib/domain/approvals";

type Summary = {
  total: number;
  byKind: Record<ApprovalKind, number>;
};

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function ApprovalsPageClient({
  items,
  summary,
}: {
  items: ApprovalInboxItem[];
  summary: Summary;
}) {
  const kindCounts = (Object.keys(approvalKindLabels) as ApprovalKind[])
    .filter((kind) => summary.byKind[kind] > 0)
    .map((kind) => `${approvalKindLabels[kind]} ${summary.byKind[kind]}`)
    .join(" · ");

  return (
    <>
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / APPROVALS</p>
          <h1>승인함</h1>
          <p>
            비용·매출·입금 확정, 계약 체결, AI 제안, 에이전트 요청을 한곳에서 확인합니다. 이 화면은 조회만 하며,
            승인·반려는 각 상세에서 대표가 직접 합니다. 메일 발송처럼 보낼 때 승인하는 일은 여기에 두지 않습니다.
          </p>
        </div>
      </header>

      <section aria-label="승인 대기" className="quote-list">
        <div className="list-heading">
          <div>
            <p className="setup-code">대기</p>
            <h2>대표 승인</h2>
          </div>
          <span>{summary.total}건</span>
        </div>
        {items.length === 0 ? (
          <div className="empty-state quote-empty-inline">
            <p>지금 승인할 항목이 없습니다.</p>
          </div>
        ) : (
          <>
            {kindCounts ? <p className="form-help">{kindCounts}</p> : null}
            {items.map((item) => (
              <Link className="quote-row" href={item.href} key={item.id}>
                <div>
                  <p>
                    {item.kindLabel}
                    {item.when ? ` · ${item.when}` : ""}
                    {typeof item.amount === "number" ? ` · ${formatWon(item.amount)}` : ""}
                  </p>
                  <h3>{item.title}</h3>
                  <p className="form-help">{item.detail}</p>
                </div>
              </Link>
            ))}
          </>
        )}
      </section>
    </>
  );
}
