export const companySetupStatuses = ["not_started", "in_progress", "complete", "not_applicable"] as const;

export type CompanySetupStatus = (typeof companySetupStatuses)[number];

export type CompanySetupTemplate = {
  code: string;
  title: string;
  description: string;
  isConditional: boolean;
  sourceUrl: string;
};

const ntsRegistrationDocumentsUrl = "https://i.nts.go.kr/nts/ad/cntnts/cntntsView.do?mi=2445";
const ntsBusinessRegistrationUrl = "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2318&cntntsId=7693";

export const companySetupTemplates: readonly CompanySetupTemplate[] = [
  {
    code: "business-registration-application",
    title: "사업자등록 신청 준비",
    description: "개인사업자용 신청서 작성·제출 경로를 확인합니다.",
    isConditional: false,
    sourceUrl: ntsRegistrationDocumentsUrl,
  },
  {
    code: "business-place-document",
    title: "사업장 임차 서류 확인",
    description: "사업장을 임차한 경우 임대차계약서 사본을 준비합니다.",
    isConditional: true,
    sourceUrl: ntsRegistrationDocumentsUrl,
  },
  {
    code: "business-permit-check",
    title: "업종 인허가 필요 여부 확인",
    description: "허가·등록·신고 대상 업종이면 관련 증빙을 준비합니다.",
    isConditional: true,
    sourceUrl: ntsRegistrationDocumentsUrl,
  },
  {
    code: "joint-business-check",
    title: "공동사업 여부 확인",
    description: "공동사업이면 동업계약서가 필요한지 확인합니다.",
    isConditional: true,
    sourceUrl: ntsRegistrationDocumentsUrl,
  },
  {
    code: "business-registration-certificate",
    title: "사업자등록증 보관",
    description: "발급된 사업자등록증의 보관 위치와 확인 내용을 기록합니다.",
    isConditional: false,
    sourceUrl: ntsRegistrationDocumentsUrl,
  },
  {
    code: "tax-schedule-review",
    title: "과세 유형·첫 신고 일정 확인",
    description: "개별 사업 상황에 맞는 과세 유형과 신고 일정을 세무 전문가 또는 공식 안내로 확인합니다.",
    isConditional: false,
    sourceUrl: ntsBusinessRegistrationUrl,
  },
];

export function calculateCompanySetupProgress(items: { status: CompanySetupStatus }[]): number {
  if (items.length === 0) return 0;
  const settled = items.filter((item) => item.status === "complete" || item.status === "not_applicable").length;
  return Math.round((settled / items.length) * 100);
}

export function normalizeCompanySetupUpdate(input: {
  status: string;
  evidenceReference?: string | null;
  note?: string | null;
}): { status: CompanySetupStatus; evidenceReference: string | null; note: string | null; completedAt: Date | null } {
  if (!companySetupStatuses.includes(input.status as CompanySetupStatus)) {
    throw new Error("Unsupported company setup status");
  }

  const status = input.status as CompanySetupStatus;
  const evidenceReference = input.evidenceReference?.trim() || null;
  const note = input.note?.trim() || null;

  if (status === "complete" && !evidenceReference) {
    throw new Error("Evidence is required to mark as complete");
  }

  return {
    status,
    evidenceReference,
    note,
    completedAt: status === "complete" ? new Date() : null,
  };
}
