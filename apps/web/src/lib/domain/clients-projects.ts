export const projectStatuses = ["planned", "active", "on_hold", "complete"] as const;
export const contactRelationStatuses = ["active", "inactive"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];
export type ContactRelationStatus = (typeof contactRelationStatuses)[number];

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planned: "예정",
  active: "진행 중",
  on_hold: "보류",
  complete: "완료",
};

export const contactRelationStatusLabels: Record<ContactRelationStatus, string> = {
  active: "활성",
  inactive: "비활성",
};

export type ClientCompanyProfile = {
  name: string;
  businessRegistrationNumber: string | null;
  representativeName: string | null;
  address: string | null;
  businessType: string | null;
  businessItem: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  businessRegistrationRef: string | null;
};

function optionalText(value: string | undefined, max: number, label: string) {
  const trimmed = value?.trim() || null;
  if (trimmed && trimmed.length > max) throw new Error(`${label} is too long`);
  return trimmed;
}

function optionalEmail(value: string | undefined) {
  const email = value?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Client email is invalid");
  return email;
}

function optionalWebsite(value: string | undefined) {
  const website = value?.trim() || null;
  if (!website) return null;
  if (website.length > 240) throw new Error("Website is too long");
  if (!/^https?:\/\//i.test(website) && !/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(website)) {
    throw new Error("Website is invalid");
  }
  return website;
}

/** 사업자등록번호는 숫자만 남기고 10자리면 허용. 비우면 null. */
export function normalizeBusinessRegistrationNumber(value: string | undefined) {
  const raw = value?.trim() || "";
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10) throw new Error("Business registration number must be 10 digits");
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function normalizeClientName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error("Client name is required");
  if (name.length > 120) throw new Error("Client name is too long");
  return name;
}

export function normalizeClientCompanyProfile(input: {
  name: string;
  businessRegistrationNumber?: string;
  representativeName?: string;
  address?: string;
  businessType?: string;
  businessItem?: string;
  website?: string;
  phone?: string;
  email?: string;
  businessRegistrationRef?: string;
}): ClientCompanyProfile {
  return {
    name: normalizeClientName(input.name),
    businessRegistrationNumber: normalizeBusinessRegistrationNumber(input.businessRegistrationNumber),
    representativeName: optionalText(input.representativeName, 80, "Representative name"),
    address: optionalText(input.address, 240, "Address"),
    businessType: optionalText(input.businessType, 80, "Business type"),
    businessItem: optionalText(input.businessItem, 120, "Business item"),
    website: optionalWebsite(input.website),
    phone: optionalText(input.phone, 40, "Phone"),
    email: optionalEmail(input.email),
    businessRegistrationRef: optionalText(input.businessRegistrationRef, 400, "Business registration reference"),
  };
}

export function formatClientListMeta(client: {
  businessRegistrationNumber?: string | null;
  representativeName?: string | null;
  contactCount: number;
  projectCount: number;
}) {
  const parts = [
    client.businessRegistrationNumber?.trim() || null,
    client.representativeName?.trim() ? `대표 ${client.representativeName.trim()}` : null,
    `담당자 ${client.contactCount}명`,
    `프로젝트 ${client.projectCount}개`,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function normalizeClientContact(input: {
  clientId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  relationStatus: string;
  taxInvoiceRecipient?: boolean | string;
}): {
  clientId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  relationStatus: ContactRelationStatus;
  taxInvoiceRecipient: boolean;
} {
  const clientId = input.clientId.trim();
  const name = input.name.trim();
  const role = input.role?.trim() || null;
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const taxInvoiceRecipient =
    input.taxInvoiceRecipient === true ||
    input.taxInvoiceRecipient === "on" ||
    input.taxInvoiceRecipient === "true" ||
    input.taxInvoiceRecipient === "1";

  if (!clientId) throw new Error("Client is required");
  if (!name) throw new Error("Contact name is required");
  if (name.length > 80) throw new Error("Contact name is too long");
  if (role && role.length > 80) throw new Error("Contact role is too long");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Contact email is invalid");
  if (phone && phone.length > 40) throw new Error("Contact phone is too long");
  if (!contactRelationStatuses.includes(input.relationStatus as ContactRelationStatus)) {
    throw new Error("Unsupported contact relation status");
  }
  if (taxInvoiceRecipient && !email) {
    throw new Error("Tax invoice recipient email is required");
  }

  return {
    clientId,
    name,
    role,
    email,
    phone,
    relationStatus: input.relationStatus as ContactRelationStatus,
    taxInvoiceRecipient,
  };
}

export function normalizeProjectRegistration(input: {
  clientId: string;
  name: string;
  status: string;
  progressPercent: string;
}): { clientId: string; name: string; status: ProjectStatus; progressPercent: number } {
  const clientId = input.clientId.trim();
  const name = input.name.trim();
  const progressPercent = Number(input.progressPercent);

  if (!clientId) throw new Error("Client is required");
  if (!name) throw new Error("Project name is required");
  if (name.length > 160) throw new Error("Project name is too long");
  if (!projectStatuses.includes(input.status as ProjectStatus)) throw new Error("Unsupported project status");
  if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    throw new Error("Progress must be between 0 and 100");
  }

  return { clientId, name, status: input.status as ProjectStatus, progressPercent };
}

export function normalizeProjectProgressUpdate(input: {
  projectId: string;
  status: string;
  progressPercent: string;
}): { projectId: string; status: ProjectStatus; progressPercent: number } {
  const projectId = input.projectId.trim();
  const progressPercent = Number(input.progressPercent);

  if (!projectId) throw new Error("Project is required");
  if (!projectStatuses.includes(input.status as ProjectStatus)) throw new Error("Unsupported project status");
  if (!Number.isInteger(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    throw new Error("Progress must be between 0 and 100");
  }

  return { projectId, status: input.status as ProjectStatus, progressPercent };
}
