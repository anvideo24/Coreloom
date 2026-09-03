import Link from "next/link";
import type { ReactNode } from "react";

import { adminManualNav, type ManualBlock, type ManualInline } from "@/lib/domain/admin-manual";

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
    if (block.type === "code") return <pre key={index}><code>{block.text}</code></pre>;
    if (block.type === "quote") return <blockquote key={index}><InlineText inlines={block.inlines} /></blockquote>;
    return <p key={index}><InlineText inlines={block.inlines} /></p>;
  });
}

export function AdminManualFrame({
  currentHref,
  deployVersion,
  deployCommit,
  manualCommit,
  title,
  intro,
  blocks,
  children,
}: {
  currentHref: string;
  deployVersion: string;
  deployCommit: string;
  manualCommit: string;
  title: string;
  intro: string;
  blocks?: ManualBlock[];
  children?: ReactNode;
}) {
  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / ADMIN MANUAL</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
      </header>
      <p className="manual-meta">배포 버전 {deployVersion} · 배포 커밋 {deployCommit} · 매뉴얼 원본 커밋 {manualCommit}</p>
      <nav aria-label="매뉴얼 메뉴" className="manual-menu">
        {adminManualNav.map((item) => (
          <Link aria-current={item.href === currentHref ? "page" : undefined} href={item.href} key={item.href}>{item.label}</Link>
        ))}
      </nav>
      <section aria-label={title} className="manual-document">
        {blocks ? <ManualBlocks blocks={blocks} /> : children}
      </section>
    </main>
  );
}
