import Link from "next/link";
import { redirect } from "next/navigation";

import {
  updateCompanyProfileAction,
  updateCompanySetupAction,
} from "@/app/(private)/company-setup/actions";
import { founderSession } from "@/lib/auth/session";
import { companyProfileStorageMissingMessage } from "@/lib/company-setup/profile-storage";
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

  const { items, companyProfile, companyProfileStorage } = await listFounderCompanySetup(
    session.founder.id,
  );
  const progress = calculateCompanySetupProgress(items);
  const profileStorageMissing = companyProfileStorage === "missing_table";

  return (
    <main className="operations-shell">
      <header className="operations-header">
        <div>
          <p className="auth-eyebrow">CORELOOM / COMPANY SETUP</p>
          <h1>회사 설립 준비</h1>
          <p>
            개인사업자 시작에 필요한 확인과 증빙 위치를 한곳에 남깁니다. 견적·청구 문서에 나갈 공급자·입금
            안내도 여기서 한 번 적어두면 문서가 그 값을 읽습니다. 세무 판단은 공식 안내 또는 전문가 확인 뒤
            대표가 직접 확정합니다. 증빙 위치 없이 항목을 완료로 바꿀 수 없습니다.
          </p>
        </div>
        <div className="quote-header-links">
          <Link className="text-link" href="/documents">
            비공개 문서함
          </Link>
        </div>
      </header>

      <section aria-label="설립 준비 진행률" className="progress-card">
        <div>
          <p>완료 현황</p>
          <strong>{progress}%</strong>
        </div>
        <div aria-hidden="true" className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section aria-label="견적·청구 공급자 정보" className="quote-editor-card">
        <p className="setup-code">문서 공급자 · 입금 안내</p>
        <p className="form-help">
          견적서·청구서 INVOICE 하단에 들어가는 값입니다. 여기서 저장한 내용만 문서에 나갑니다.
        </p>
        {profileStorageMissing ? (
          <p className="auth-notice" role="status">
            {companyProfileStorageMissingMessage}
          </p>
        ) : null}
        <form action={updateCompanyProfileAction}>
          <fieldset className="setup-form company-profile-form" disabled={profileStorageMissing}>
          <label>
            브랜드명
            <input defaultValue={companyProfile.brandName} name="brandName" required />
          </label>
          <label>
            상호(정식)
            <input defaultValue={companyProfile.legalName} name="legalName" />
          </label>
          <label>
            사업자등록번호
            <input
              defaultValue={companyProfile.businessRegistrationNumber}
              name="businessRegistrationNumber"
            />
          </label>
          <label>
            대표
            <input defaultValue={companyProfile.representativeName} name="representativeName" />
          </label>
          <label className="setup-form-note">
            주소
            <input defaultValue={companyProfile.address} name="address" />
          </label>
          <label>
            이메일
            <input defaultValue={companyProfile.email} name="email" type="email" />
          </label>
          <label>
            은행
            <input defaultValue={companyProfile.bankName} name="bankName" />
          </label>
          <label>
            계좌
            <input defaultValue={companyProfile.bankAccount} name="bankAccount" />
          </label>
          <label>
            예금주
            <input defaultValue={companyProfile.accountHolder} name="accountHolder" />
          </label>
          <label>
            SWIFT
            <input defaultValue={companyProfile.swift} name="swift" />
          </label>
          <button className="auth-submit" type="submit">
            공급자·입금 정보 저장
          </button>
          </fieldset>
        </form>
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
              <a href={item.sourceUrl} rel="noreferrer" target="_blank">
                공식 안내 보기
              </a>
            </div>

            <form action={updateCompanySetupAction} className="setup-form">
              <input name="itemId" type="hidden" value={item.id} />
              <label>
                상태
                <select defaultValue={item.status} name="status">
                  {companySetupStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                증빙 위치 또는 링크
                <input
                  defaultValue={item.evidenceReference ?? ""}
                  name="evidenceReference"
                  placeholder="예: C:\\Coreloom\\evidence 또는 안전한 문서 링크"
                />
              </label>
              <label className="setup-form-note">
                확인 메모
                <input
                  defaultValue={item.note ?? ""}
                  name="note"
                  placeholder="무엇을 확인했는지 간단히 기록"
                />
              </label>
              <button className="auth-submit" type="submit">
                변경 저장
              </button>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}
