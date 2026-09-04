import Link from "next/link";
import type { ReactNode } from "react";

import { ADMIN_MANUAL_HOME_HREF, type ManualBlock, type ManualInline } from "@/lib/domain/admin-manual";

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

function ManualBlocks({ blocks }: { blocks: ManualBlock[] }) {
  return blocks.map((block, index) => {
    if (block.type === "heading" && block.level === 1) return <h2 key={index}>{block.text}</h2>;
    if (block.type === "heading" && block.level === 2) return <h3 key={index}>{block.text}</h3>;
    if (block.type === "heading") return <h4 key={index}>{block.text}</h4>;
    if (block.type === "list") {
      const ListTag = block.ordered ? "ol" : "ul";
      return <ListTag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineText inlines={item} /></li>)}</ListTag>;
    }
    if (block.type === "table") return <table key={index}><thead><tr>{block.headers.map((header, headerIndex) => <th key={headerIndex}>{header}</th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
    if (block.type === "code") return <pre key={index}><code>{block.text}</code></pre>;
    if (block.type === "quote") return <blockquote key={index}><InlineText inlines={block.inlines} /></blockquote>;
    return <p key={index}><InlineText inlines={block.inlines} /></p>;
  });
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
}) {
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
      <p className="manual-meta">
        배포 버전 {deployVersion} · 배포 커밋 {deployCommit} · 매뉴얼 원본 커밋 {manualCommit}
        {sourceLabel ? ` · 원본 ${sourceLabel}` : ""}
      </p>
      <section aria-label={title} className={home ? "manual-home" : "manual-document"}>
        {blocks ? <ManualBlocks blocks={blocks} /> : children}
      </section>
    </main>
  );
}
