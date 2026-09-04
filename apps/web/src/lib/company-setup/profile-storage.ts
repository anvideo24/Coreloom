export const workspaceCompanyProfilesTable = "workspace_company_profiles";

export type CompanyProfileStorageState = "ready" | "missing_table";

/** 0022 미적용 시 화면·저장 실패에 쓰는 안내. 적용 여부는 개발 PC에서 확인한다. */
export const companyProfileStorageMissingMessage =
  "회사 프로필 저장소가 아직 없습니다. 개발 PC의 apps/web에서 npm run db:migrate 로 0022를 적용한 뒤 다시 저장하세요.";
