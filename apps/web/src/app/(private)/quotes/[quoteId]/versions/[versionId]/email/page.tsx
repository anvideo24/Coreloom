import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { sendQuoteVersionEmailAction } from "@/app/(private)/quotes/actions";
import { founderSession } from "@/lib/auth/session";
import { quoteEmailConfigured } from "@/lib/quotes/email";
import { getFounderQuoteDetail, listFounderQuoteEmailDeliveries } from "@/lib/quotes/repository";

export const dynamic = "force-dynamic";

export default async function QuoteEmailPage({ params, searchParams }: { params: Promise<{ quoteId: string; versionId: string }>; searchParams: Promise<{ status?: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");
  const { quoteId, versionId } = await params;
  const { status } = await searchParams;
  const detail = await getFounderQuoteDetail(session.founder.id, quoteId);
  const version = detail?.versions.find((candidate) => candidate.id === versionId);
  if (!detail || !version) notFound();
  const configured = quoteEmailConfigured();
  const deliveries = await listFounderQuoteEmailDeliveries(session.founder.id, quoteId, versionId);
  const defaultSubject = `[견적서] ${version.title}`;
  const defaultMessage = `안녕하세요.\n\n${version.title} 견적서를 첨부드립니다.\n검토 후 회신 부탁드립니다.\n\n감사합니다.`;

  return <main className="operations-shell"><header className="operations-header"><div><p className="auth-eyebrow">CORELOOM / QUOTE EMAIL</p><h1>견적서 이메일 발송</h1><p>{detail.quote.clientName} · v{version.versionNumber} PDF를 첨부합니다.</p></div><Link className="text-link" href={`/quotes/${quoteId}/versions/${versionId}/print`}>견적서 보기</Link></header>
    {status === "accepted" ? <p className="auth-notice">메일 서비스가 발송 요청을 접수했습니다. 실제 수신 여부는 수신자 메일함 또는 이후 전달 상태에서 확인합니다.</p> : null}
    {status === "failed" ? <p className="auth-error">메일을 발송하지 못했습니다. 수신자·발신 메일 연결 상태를 확인한 뒤 다시 시도해 주세요.</p> : null}
    {!configured ? <section className="quote-editor-card"><h2>메일 발송 연결이 필요합니다</h2><p className="form-help">아직 외부 메일은 발송되지 않습니다. Resend API 키와 인증된 발신 메일을 로컬 비밀 설정에 연결하면 이 화면에서만 대표 승인 뒤 발송할 수 있습니다.</p></section> : <section className="quote-editor-card"><form action={sendQuoteVersionEmailAction} className="quote-form"><input name="quoteId" type="hidden" value={quoteId} /><input name="quoteVersionId" type="hidden" value={versionId} /><label className="quote-form-full">받는 사람 이메일<input name="recipient" required type="email" /></label><label className="quote-form-full">제목<input defaultValue={defaultSubject} name="subject" required /></label><label className="quote-form-full">본문<textarea defaultValue={defaultMessage} name="message" required /></label><label className="quote-email-approval quote-form-full"><input name="approved" required type="checkbox" value="true" /> 수신자·내용·첨부 견적 버전을 확인했고, 대표로서 이 이메일 발송을 승인합니다.</label><button className="auth-submit" type="submit">PDF 첨부 이메일 발송</button></form></section>}
    <section className="quote-list"><div className="list-heading"><div><p className="setup-code">발송 이력</p><h2>이 버전의 메일</h2></div><span>{deliveries.length}개</span></div>{deliveries.length === 0 ? <p className="empty-state">아직 발송 요청 이력이 없습니다.</p> : deliveries.map((delivery) => <article className="quote-row" key={delivery.id}><div><p>{delivery.recipient}</p><h3>{delivery.subject}</h3></div><strong>{delivery.status === "accepted" ? "요청 접수" : delivery.status === "failed" ? "발송 실패" : "발송 중"}</strong></article>)}</section>
  </main>;
}
