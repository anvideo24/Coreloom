"use client";
import type { SystemMapNode } from "@/lib/domain/manual-system-map";
import { useState } from "react";
import styles from "./manual-system-map.module.css";

export function ManualSystemMap({ nodes }: { nodes: SystemMapNode[] }) {
  const [selected, setSelected] = useState<string | null>(nodes.find((node) => node.id === "ai")?.id ?? nodes[0]?.id ?? null);
  return (
    <div className={styles.map}>
      <div className={styles.owner}><strong>대표가 판단하고 실행합니다</strong><span>AI 대화 ≠ 발송·확정 권한</span></div>
      <div className={styles.hub}><strong>Coreloom</strong><span>회사 준비 · 고객 수주 · 재무 · 업무<br />권한을 확인하고 기록을 연결하는 중심</span></div>
      <div className={styles.tree} aria-label="시스템 구성">
        {nodes.map((node) => {
          const open = selected === node.id;
          const detailId = `manual-system-map-detail-${node.id}`;
          const titleId = `${detailId}-title`;
          return (
            <div className={styles.nodeWrap} key={node.id}>
              <button type="button" className={styles.node} aria-label={`${node.label} ${node.summary}`} aria-expanded={open} {...(open ? { "aria-controls": detailId } : {})} onClick={() => setSelected(open ? null : node.id)}>
                <strong>{node.label}</strong><span>{node.summary}</span>
              </button>
              {open && <section id={detailId} className={styles.detail} role="region" aria-labelledby={titleId}>
                <h3 id={titleId}>{node.title}</h3>
                <p className={styles.route}>{node.route}</p>
                <ul>{node.details.map((detail, index) => <li key={`${node.id}-detail-${index}`}>{detail}</li>)}</ul>
              </section>}
            </div>
          );
        })}
      </div>
      <p className={styles.footer}>선은 관계이며 자동 처리·정보 전체 전송을 뜻하지 않습니다. 실시간 연결 상태를 보여주는 화면이 아닙니다.</p>
    </div>
  );
}
