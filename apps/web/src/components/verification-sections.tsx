import Link from "next/link";
import { Fragment } from "react";

import { VerificationOutcomeBadge } from "@/components/verification-badge";
import { shortenCommit } from "@/lib/domain/admin-manual";
import {
  outcomeLabel,
  stageLabel,
  type CheckResult,
  type CheckStatus,
  type FeatureStatus,
} from "@/lib/domain/verification-plan";

function featureHref(featureId: string) {
  return `/admin/manual/progress/${encodeURIComponent(featureId)}`;
}

/** 목표가 셀 수 있는 수를 요구할 때 「몇 개를 쟀나」. 없으면 안 보인다. */
function MeasuredCoverage({ result }: { result: CheckResult }) {
  if (!result.measured) return null;
  const { covered, total } = result.measured;
  return (
    <span className="verification-coverage">
      잰 범위 {covered}/{total}
      {covered < total ? " (덜 쟀음)" : ""}
    </span>
  );
}

function evidenceText(result: CheckResult) {
  const by = result.evidence.by ? ` · ${result.evidence.by}` : "";
  return `${result.evidence.ref} · ${result.evidence.checkedAt}${by}`;
}

/** 검사마다 이력이 2건 이상일 때만 접이식으로 이전 결과를 남긴다. 최신은 이미 위에 나와 있으니 나머지만 편다. */
function CheckHistory({ history }: { history: CheckResult[] }) {
  if (history.length < 2) return null;
  const past = history.slice(1);
  return (
    <details className="verification-history">
      <summary>이전 결과 {past.length}건 보기</summary>
      <ul>
        {past.map((result, index) => (
          <li key={`${result.evidence.checkedAt}-${index}`}>
            {result.evidence.checkedAt} · {outcomeLabel(result.outcome)} · {result.value} · {shortenCommit(result.codeCommit)} · {result.environment}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function VerificationFeatureList({ statuses }: { statuses: FeatureStatus[] }) {
  if (statuses.length === 0) {
    return <p className="verification-note">계획서에 등록된 기능이 없습니다.</p>;
  }

  return (
    <>
      <div className="verification-table-wrap">
        <table className="verification-table">
          <thead>
            <tr>
              <th>기능</th>
              <th>목표</th>
              <th>구현 단계</th>
              <th>통과/필수</th>
              <th>실패</th>
              <th>재검증</th>
              <th>결과 없음</th>
              <th>다음 행동</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((status) => (
              <tr key={status.feature.id}>
                <td>
                  <Link className="verification-link" href={featureHref(status.feature.id)}>
                    {status.feature.id} · {status.feature.name}
                  </Link>
                </td>
                <td>{status.feature.goal || "—"}</td>
                <td className="verification-nowrap">{stageLabel(status.implementation?.stage ?? null)}</td>
                <td className="verification-nowrap">{status.counts.pass} / {status.counts.required}</td>
                <td className="verification-nowrap">{status.counts.fail}</td>
                <td className="verification-nowrap">{status.counts.recheck}</td>
                <td className="verification-nowrap">{status.counts.none}</td>
                <td>{status.nextAction}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="verification-cards">
        {statuses.map((status) => (
          <article className="verification-card" key={status.feature.id}>
            <h3>
              <Link className="verification-link" href={featureHref(status.feature.id)}>
                {status.feature.id} · {status.feature.name}
              </Link>
            </h3>
            <dl>
              <dt>목표</dt>
              <dd>{status.feature.goal || "—"}</dd>
              <dt>구현 단계</dt>
              <dd>{stageLabel(status.implementation?.stage ?? null)}</dd>
              <dt>통과/필수</dt>
              <dd>{status.counts.pass} / {status.counts.required}</dd>
              <dt>실패</dt>
              <dd>{status.counts.fail}</dd>
              <dt>재검증</dt>
              <dd>{status.counts.recheck}</dd>
              <dt>결과 없음</dt>
              <dd>{status.counts.none}</dd>
              <dt>다음 행동</dt>
              <dd>{status.nextAction}</dd>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

export function VerificationCheckTable({ checks }: { checks: CheckStatus[] }) {
  if (checks.length === 0) {
    return <p className="verification-note">이 기능에 등록된 검사가 없습니다.</p>;
  }

  return (
    <>
      <div className="verification-check-table-wrap">
        <table className="verification-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>목표·통과 기준</th>
              <th>계획 v1 당시 판정</th>
              <th>현재 상태</th>
              <th>결과값</th>
              <th>증거 · 검증 코드 커밋 · 환경</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((status) => (
              <Fragment key={status.check.id}>
                <tr>
                  <td className="verification-nowrap">{status.check.id}</td>
                  <td>{status.check.target}</td>
                  <td>{status.check.planVerdict}</td>
                  <td>
                    <VerificationOutcomeBadge outcome={status.effective} />
                    {status.reason ? <span className="verification-reason">{status.reason}</span> : null}
                  </td>
                  <td>
                    {status.latest?.value ?? "—"}
                    {status.latest ? <MeasuredCoverage result={status.latest} /> : null}
                  </td>
                  <td>
                    {status.latest ? (
                      <span className="verification-stack">
                        <span>{evidenceText(status.latest)}</span>
                        <span className="verification-nowrap">커밋 {shortenCommit(status.latest.codeCommit)}</span>
                        <span>{status.latest.environment}</span>
                      </span>
                    ) : "—"}
                  </td>
                </tr>
                {status.history.length >= 2 ? (
                  <tr>
                    <td colSpan={6}>
                      <CheckHistory history={status.history} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="verification-check-cards">
        {checks.map((status) => (
          <article className="verification-check-card" key={status.check.id}>
            <h4>{status.check.id}</h4>
            <dl>
              <dt>목표·통과 기준</dt>
              <dd>{status.check.target}</dd>
              <dt>계획 v1 당시 판정</dt>
              <dd>{status.check.planVerdict}</dd>
              <dt>현재 상태</dt>
              <dd><VerificationOutcomeBadge outcome={status.effective} /></dd>
              <dt>통과가 아닌 이유</dt>
              <dd>{status.reason ?? "—"}</dd>
              <dt>결과값</dt>
              <dd>
                {status.latest?.value ?? "—"}
                {status.latest ? <MeasuredCoverage result={status.latest} /> : null}
              </dd>
              <dt>증거</dt>
              <dd>{status.latest ? evidenceText(status.latest) : "—"}</dd>
              <dt>검증 코드 커밋</dt>
              <dd>{status.latest ? shortenCommit(status.latest.codeCommit) : "—"}</dd>
              <dt>환경</dt>
              <dd>{status.latest?.environment ?? "—"}</dd>
            </dl>
            <CheckHistory history={status.history} />
          </article>
        ))}
      </div>
    </>
  );
}
