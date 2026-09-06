"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { ADMIN_MANUAL_HOME_HREF, type ManualBlock, type ManualInline } from "@/lib/domain/admin-manual";

function headingId(text: string, used: Set<string>) {
  const slug = text
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "section";
  const base = `manual-${slug}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function headingEntries(blocks: ManualBlock[]) {
  const usedIds = new Set<string>();
  const entries: Array<ManualBlock & { type: "heading"; id: string }> = [];
  const visit = (items: ManualBlock[]) => items.forEach((block) => {
    if (block.type === "heading") entries.push({ ...block, id: headingId(block.text, usedIds) });
    if (block.type === "historical") visit(block.blocks);
  });
  visit(blocks);
  return entries;
}

function InlineText({ inlines }: { inlines: ManualInline[] }) {
  return inlines.map((part, index) => {
    if (part.type === "strong") return <strong key={index}>{part.text}</strong>;
    if (part.type === "code") return <code key={index}>{part.text}</code>;
    if (part.type === "link") {
      if (part.href?.startsWith("/")) return <Link href={part.href} key={index}>{part.text}</Link>;
      if (part.href) return <a href={part.href} key={index} rel="noreferrer" target="_blank">{part.text}</a>;
      return <span key={index}>{part.text}</span>;
    }
    return <span key={index}>{part.text}</span>;
  });
}

export function ManualBlocks({ blocks }: { blocks: ManualBlock[] }) {
  const headings = headingEntries(blocks);
  let headingIndex = 0;
  const renderBlocks = (items: ManualBlock[]) => items.map((block, index) => {
    if (block.type === "historical") {
      return <details className="manual-history" key={index}><summary>과거 구현 기록 (원문 보존)</summary><div className="manual-history-content">{renderBlocks(block.blocks)}</div></details>;
    }
    if (block.type === "heading") {
      const id = headings[headingIndex++].id;
      if (block.level === 1) return <h2 id={id} key={index}>{block.text}</h2>;
      if (block.level === 2) return <h3 id={id} key={index}>{block.text}</h3>;
      return <h4 id={id} key={index}>{block.text}</h4>;
    }
    if (block.type === "list") {
      const ListTag = block.ordered ? "ol" : "ul";
      return <ListTag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineText inlines={item} /></li>)}</ListTag>;
    }
    if (block.type === "table") return <div className="manual-table-region" role="region" aria-label={`표: ${block.headers.join(", ")}`} tabIndex={0} key={index}><table><thead><tr>{block.headers.map((header, headerIndex) => <th scope="col" key={headerIndex}>{header}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
    if (block.type === "code") return <pre key={index}><code>{block.text}</code></pre>;
    if (block.type === "quote") return <blockquote key={index}><InlineText inlines={block.inlines} /></blockquote>;
    return <p key={index}><InlineText inlines={block.inlines} /></p>;
  });
  return renderBlocks(blocks);
}

export function AdminManualFrame({
  home = false,
  deployVersion,
  deployCommit,
  manualCommit,
  sourceLabel,
  title,
  intro,
  blocks,
  children,
  contentLayout = "document",
}: {
  /** 홈은 고르는 입구라 되돌아갈 곳이 없다. 나머지 화면은 홈으로 돌아가는 길을 위에 둔다. */
  home?: boolean;
  deployVersion: string;
  deployCommit: string;
  manualCommit: string;
  sourceLabel?: string;
  title: string;
  intro: string;
  blocks?: ManualBlock[];
  children?: ReactNode;
  /** 업무 지도처럼 읽기 폭·문서 카드가 필요 없는 구조화된 화면. */
  contentLayout?: "document" | "canvas";
}) {
  const headings = blocks ? headingEntries(blocks) : [];
  const hasToc = !home && headings.length > 0;

  useEffect(() => {
    const openHashTarget = () => {
      const rawHash = window.location.hash.slice(1);
      if (!rawHash) return;
      let target: HTMLElement | null = null;
      try {
        target = document.getElementById(decodeURIComponent(rawHash));
      } catch {
        return;
      }
      let parent = target?.parentElement?.closest("details") as HTMLDetailsElement | null;
      while (parent) {
        parent.open = true;
        parent = parent.parentElement?.closest("details") as HTMLDetailsElement | null;
      }
      target?.scrollIntoView?.({ block: "start" });
    };
    openHashTarget();
    window.addEventListener("hashchange", openHashTarget);
    return () => window.removeEventListener("hashchange", openHashTarget);
  }, []);

  return (
    <main className="operations-shell">
      {home ? null : (
        <nav aria-label="매뉴얼 위치" className="manual-back">
          <Link href={ADMIN_MANUAL_HOME_HREF}>매뉴얼 홈</Link>
        </nav>
      )}
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / ADMIN MANUAL</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
      </header>
      <details className="manual-meta-disclosure">
        <summary>문서 정보</summary>
        <p className="manual-meta">
          배포 버전 {deployVersion} · 배포 커밋 {deployCommit} · 매뉴얼 원본 커밋 {manualCommit}
          {sourceLabel ? ` · 원본 ${sourceLabel}` : ""}
        </p>
      </details>
      <section aria-label={title} className={home ? "manual-home" : hasToc ? "manual-document-layout" : "manual-document-layout manual-document-layout-no-toc"}>
        {hasToc ? <>
          <nav aria-label="이 문서의 차례" className="manual-toc manual-toc-desktop"><p>이 문서의 차례</p><ol>{headings.map((heading) => <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ol></nav>
          <details className="manual-toc manual-toc-mobile"><summary>이 문서의 차례</summary><nav aria-label="이 문서의 차례"><ol>{headings.map((heading) => <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ol></nav></details>
        </> : null}
        {home ? (blocks ? <ManualBlocks blocks={blocks} /> : children) : <div className={contentLayout === "canvas" ? "manual-canvas" : "manual-document"}>{blocks ? <ManualBlocks blocks={blocks} /> : children}</div>}
      </section>
    </main>
  );
}
