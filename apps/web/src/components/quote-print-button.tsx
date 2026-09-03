"use client";

export function QuotePrintButton() {
  return <button className="auth-submit quote-print-button" onClick={() => window.print()} type="button">인쇄 / PDF 저장</button>;
}
