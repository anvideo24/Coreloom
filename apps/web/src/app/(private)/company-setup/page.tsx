import Link from "next/link";
import { redirect } from "next/navigation";

import { updateCompanySetupAction } from "@/app/(private)/company-setup/actions";
import { founderSession } from "@/lib/auth/session";
import { listFounderCompanySetup } from "@/lib/company-setup/repository";
import { calculateCompanySetupProgress, companySetupStatuses } from "@/lib/domain/company-setup";

export const dynamic = "force-dynamic";

const statusLabels = {
  not_started: "시작 전",
  in_progress: "진행 중",
  complete: "완료",
  not_applicable: "해당 없음",
} as const;

export default async function CompanySetupPage() {
  const session = await founderSession();
  if (session.state === "signed-out") redirect("/sign-in");
  if (session.state === "denied") redirect("/dashboard");

  const { items } = await listFounderCompanySetup(session.founder.id);
  const progress = calculateCompanySetupProgress(items);

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / COMPANY SETUP</p>
          <h1>회사 설립 준비</h1>
          <p>개인사업자 시작에 필요한 확인과 증빙 위치를 한곳에 남깁니다. 세무 판단은 공식 안내 또는 전문가 확인 뒤 대표가 직접 확정합니다. 원본 위치의 버전 보관은 비공개 문서함에서 이어갑니다.</p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/documents">비공개 문서함</Link>
        </div>
      </header>

      <section aria-label="설립 준비 진행률" className="progress-card">
        <div>
          <p>완료 현황</p>
          <strong>{progress}%</strong>
        </div>
        <div aria-hidden="true" className="progress-track"><span style={{ width: `${progress}%` }} /></div>
      </section>

      <section aria-label="설립 준비 항목" className="setup-list">
        {items.map((item) => (
          <article className="setup-card" key={item.id}>
            <div className="setup-card-heading">
              <div>
                <p className="setup-code">{item.isConditional ? "상황별 확인" : "필수 확인"}</p>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
              <a href={item.sourceUrl} rel="noreferrer" target="_blank">공식 안내 보기</a>
            </div>

            <form action={updateCompanySetupAction} className="setup-form">
              <input name="itemId" type="hidden" value={item.id} />
              <label>
                상태
                <select defaultValue={item.status} name="status">
                  {companySetupStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                </select>
              </label>
              <label>
                증빙 위치 또는 링크
                <input defaultValue={item.evidenceReference ?? ""} name="evidenceReference" placeholder="예: C:\\Coreloom\\evidence 또는 안전한 문서 링크" />
              </label>
              <label className="setup-form-note">
                확인 메모
                <input defaultValue={item.note ?? ""} name="note" placeholder="무엇을 확인했는지 간단히 기록" />
              </label>
              <button className="auth-submit" type="submit">변경 저장</button>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}
