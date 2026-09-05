"use client";

import { useState } from "react";
import Link from "next/link";
import type { WorkMapStep, WorkMapSupport } from "@/lib/domain/manual-work-map";
import styles from "./manual-work-map.module.css";

type ManualWorkMapProps = { steps: WorkMapStep[]; supports: WorkMapSupport[] };

export function ManualWorkMap({ steps, supports }: ManualWorkMapProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className={styles.map}>
      <section aria-labelledby="manual-work-map-flow-title">
        <div className={styles.sectionTitle}>
          <h2 id="manual-work-map-flow-title">고객사 프로젝트의 흐름</h2>
          <p>화살표는 일반적인 업무 순서입니다</p>
        </div>
        <ol className={styles.flow}>
          {steps.map((step, index) => {
            const isSelected = selected === step.id;
            const detailId = `manual-work-map-detail-${step.id}`;
            return (
              <li className={styles.step} key={step.id}>
                <button
                  type="button"
                  className={styles.node}
                  aria-expanded={isSelected}
                  aria-controls={detailId}
                  onClick={() => setSelected(isSelected ? null : step.id)}
                >
                  <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.name}>{step.label}</span>
                  <span className={styles.description}>{step.question}</span>
                  <span className={styles.sign} aria-hidden="true">{isSelected ? "−" : "＋"}</span>
                </button>
                {isSelected && (
                  <section id={detailId} className={styles.detail} aria-label={`${step.label} 설명`}>
                    <div>
                      <span className={styles.detailLabel}>선택한 업무</span>
                      <h3>{step.label}</h3>
                      <p>{step.purpose}</p>
                    </div>
                    <dl>
                      <dt>남기는 것</dt><dd>{step.record}</dd>
                      <dt>연결</dt><dd>{step.relation}</dd>
                      <dt>주의</dt><dd>{step.caution}</dd>
                    </dl>
                    <div className={styles.detailAction}>
                      <Link className={styles.open} href={step.href} prefetch={false}>{step.linkLabel} 화면으로 →</Link>
                    </div>
                  </section>
                )}
              </li>
            );
          })}
        </ol>
        <p className={styles.flowNote}>프로젝트 등록 순서는 달라질 수 있습니다. 화살표를 따라 자동으로 저장·발송·확정되지는 않습니다.</p>
      </section>

      <section className={styles.support} aria-labelledby="manual-work-map-support-title">
        <div className={styles.sectionTitle}>
          <h2 id="manual-work-map-support-title">흐름을 함께 받쳐주는 일</h2>
          <p>필요한 설명만 펼쳐보세요</p>
        </div>
        <div className={styles.supportGrid}>
          {supports.map((support) => (
            <details key={support.id} className={styles.supportItem}>
              <summary>{support.label}</summary>
              <p>{support.summary}</p>
              <p><strong>{support.relation}</strong><br />{support.description}</p>
              <Link href={support.href} prefetch={false}>{support.linkLabel}</Link>
            </details>
          ))}
        </div>
      </section>
      <footer className={styles.footer}>앱·구독 매출과 비용은 이 고객 수주 흐름과 별도로 관리합니다.</footer>
    </div>
  );
}
