/** 견적·청구 문서에 쓰는 공급자(우리 회사) 프로필. 워크스페이스에 1건. */
export type WorkspaceCompanyProfileInput = {
  brandName?: string | null;
  legalName?: string | null;
  businessRegistrationNumber?: string | null;
  representativeName?: string | null;
  address?: string | null;
  email?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  accountHolder?: string | null;
  swift?: string | null;
  signatureSrc?: string | null;
};

export type QuoteIssuerProfile = {
  brandName: string;
  accentColor: string;
  legalName: string;
  businessRegistrationNumber: string;
  representativeName: string;
  address: string;
  email: string;
  bankName: string;
  bankAccount: string;
  accountHolder: string;
  swift: string;
  currency: string;
  signatureSrc: string;
};

/** 브랜드 기본값. 사업자·계좌 등 민감 값은 회사 프로필에만 둔다. */
export const quoteIssuerBrandDefaults = {
  brandName: "coreloom",
  accentColor: "#e24a1b",
  email: "hello@coreloom.io",
  currency: "KRW",
  signatureSrc: "/brand/signature.png",
} as const;

/** @deprecated resolveQuoteIssuerProfile 사용. 브랜드 기본만 담는다. */
export const quoteIssuerProfile = resolveQuoteIssuerProfile(null);

export function resolveQuoteIssuerProfile(
  stored?: WorkspaceCompanyProfileInput | null,
): QuoteIssuerProfile {
  const pick = (value: string | undefined | null, fallback = "") => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : fallback;
  };

  return {
    brandName: pick(stored?.brandName, quoteIssuerBrandDefaults.brandName),
    accentColor: quoteIssuerBrandDefaults.accentColor,
    legalName: pick(stored?.legalName),
    businessRegistrationNumber: pick(stored?.businessRegistrationNumber),
    representativeName: pick(stored?.representativeName),
    address: pick(stored?.address),
    email: pick(stored?.email, quoteIssuerBrandDefaults.email),
    bankName: pick(stored?.bankName),
    bankAccount: pick(stored?.bankAccount),
    accountHolder: pick(stored?.accountHolder, quoteIssuerBrandDefaults.brandName),
    swift: pick(stored?.swift),
    currency: quoteIssuerBrandDefaults.currency,
    signatureSrc: pick(stored?.signatureSrc, quoteIssuerBrandDefaults.signatureSrc),
  };
}

export function normalizeWorkspaceCompanyProfileInput(input: WorkspaceCompanyProfileInput) {
  const trim = (value: string | null | undefined, max: number) => {
    const next = (value ?? "").trim();
    if (next.length > max) throw new Error("Company profile field is too long");
    return next;
  };
  return {
    brandName: trim(input.brandName, 80) || quoteIssuerBrandDefaults.brandName,
    legalName: trim(input.legalName, 120),
    businessRegistrationNumber: trim(input.businessRegistrationNumber, 40),
    representativeName: trim(input.representativeName, 80),
    address: trim(input.address, 240),
    email: trim(input.email, 160) || quoteIssuerBrandDefaults.email,
    bankName: trim(input.bankName, 80),
    bankAccount: trim(input.bankAccount, 80),
    accountHolder: trim(input.accountHolder, 80) || quoteIssuerBrandDefaults.brandName,
    swift: trim(input.swift, 40),
    signatureSrc: trim(input.signatureSrc, 200) || quoteIssuerBrandDefaults.signatureSrc,
  };
}
