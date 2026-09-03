"use client";

export function QuoteDocumentActions({ downloadHref }: { downloadHref: string }) {
  return <div className="quote-document-actions"><a className="auth-submit quote-print-button" download href={downloadHref}>PDF 다운로드</a><button className="text-link quote-print-link" onClick={() => window.print()} type="button">인쇄</button></div>;
}
