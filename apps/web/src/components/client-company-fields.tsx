import type { ClientCompanyProfile, ClientTaxType } from "@/lib/domain/clients-projects";
import { clientTaxTypeLabels, clientTaxTypes } from "@/lib/domain/clients-projects";

type ClientCompanyFieldsProps = {
  defaults?: Partial<ClientCompanyProfile>;
  /** 생성 시 첫 담당자 칸을 보여 준다 */
  includeFirstContact?: boolean;
};

/** 견적 작성처럼 구역 + 2열. 짧은 칸은 나란히, 주소·증빙은 한 줄. */
export function ClientCompanyFields({ defaults, includeFirstContact = false }: ClientCompanyFieldsProps) {
  return (
    <>
      <p className="setup-code quote-form-full">회사</p>
      <label className="quote-form-full">
        상호
        <input defaultValue={defaults?.name ?? ""} name="name" placeholder="예: 주식회사 예시" required />
      </label>
      <label>
        사업자등록번호
        <input
          defaultValue={defaults?.businessRegistrationNumber ?? ""}
          inputMode="numeric"
          name="businessRegistrationNumber"
          placeholder="000-00-00000"
        />
      </label>
      <label>
        대표자명
        <input defaultValue={defaults?.representativeName ?? ""} name="representativeName" placeholder="예: 홍길동" />
      </label>
      <label>
        과세 유형
        <select defaultValue={defaults?.taxType ?? ""} name="taxType">
          <option value="">미정</option>
          {clientTaxTypes.map((type) => (
            <option key={type} value={type}>
              {clientTaxTypeLabels[type as ClientTaxType]}
            </option>
          ))}
        </select>
      </label>
      <label>
        업태
        <input defaultValue={defaults?.businessType ?? ""} name="businessType" placeholder="예: 서비스업" />
      </label>
      <label>
        종목
        <input defaultValue={defaults?.businessItem ?? ""} name="businessItem" placeholder="예: 소프트웨어 개발" />
      </label>
      <label className="quote-form-full">
        주소
        <input defaultValue={defaults?.address ?? ""} name="address" placeholder="사업장 주소" />
      </label>

      <p className="setup-code quote-form-full">연락</p>
      <label>
        대표 전화
        <input defaultValue={defaults?.phone ?? ""} name="phone" placeholder="02-0000-0000" />
      </label>
      <label>
        대표 이메일
        <input defaultValue={defaults?.email ?? ""} name="email" type="email" />
      </label>
      <label className="quote-form-full">
        홈페이지
        <input defaultValue={defaults?.website ?? ""} name="website" placeholder="https://example.com" />
      </label>

      <p className="setup-code quote-form-full">계좌 (환불·매입 지급 시)</p>
      <p className="form-help quote-form-full">
        매출만이면 우리 입금 계좌는 설립 준비에서 둡니다. 고객에게 돌려주거나 매입처로 보낼 때만 적습니다.
      </p>
      <label>
        은행
        <input defaultValue={defaults?.bankName ?? ""} name="bankName" placeholder="예: 국민은행" />
      </label>
      <label>
        계좌
        <input defaultValue={defaults?.bankAccount ?? ""} name="bankAccount" placeholder="계좌번호" />
      </label>
      <label>
        예금주
        <input defaultValue={defaults?.accountHolder ?? ""} name="accountHolder" />
      </label>
      <label>
        통장사본 위치 (선택)
        <input
          defaultValue={defaults?.bankBookRef ?? ""}
          name="bankBookRef"
          placeholder="파일 경로, 문서함 위치, 또는 URL"
        />
      </label>

      <p className="setup-code quote-form-full">증빙</p>
      <label className="quote-form-full">
        사업자등록증 위치 또는 링크 (선택)
        <input
          defaultValue={defaults?.businessRegistrationRef ?? ""}
          name="businessRegistrationRef"
          placeholder="파일 경로, 문서함 위치, 또는 URL"
        />
      </label>
      <p className="form-help quote-form-full">파일 업로드는 문서함에서 고객사에 연결해 보관합니다. 지금은 위치·링크도 남길 수 있습니다.</p>

      {includeFirstContact ? (
        <>
          <p className="setup-code quote-form-full">첫 담당자 (선택)</p>
          <p className="form-help quote-form-full">비워 두고 나중에 고객사 화면에서 추가할 수 있습니다.</p>
          <label>
            이름
            <input name="contactName" placeholder="예: 김담당" />
          </label>
          <label>
            역할
            <input name="contactRole" placeholder="예: 프로젝트 매니저" />
          </label>
          <label>
            이메일
            <input name="contactEmail" type="email" />
          </label>
          <label>
            전화
            <input name="contactPhone" />
          </label>
          <label className="quote-form-full quote-email-approval">
            <input name="taxInvoiceRecipient" type="checkbox" value="on" />
            세금계산서·계산서 수신 담당 (이메일이 필요합니다)
          </label>
        </>
      ) : null}
    </>
  );
}
