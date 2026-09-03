export const projectStatuses = ["planned", "active", "on_hold", "complete"] as const;
export const contactRelationStatuses = ["active", "inactive"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];
export type ContactRelationStatus = (typeof contactRelationStatuses)[number];

export const contactRelationStatusLabels: Record<ContactRelationStatus, string> = {
  active: "활성",
  inactive: "비활성",
};

export function normalizeClientName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error("Client name is required");
  if (name.length > 120) throw new Error("Client name is too long");
  return name;
}

export function normalizeClientContact(input: {
  clientId: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  relationStatus: string;
}): {
  clientId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  relationStatus: ContactRelationStatus;
} {
  const clientId = input.clientId.trim();
  const name = input.name.trim();
  const role = input.role?.trim() || null;
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;

  if (!clientId) throw new Error("Client is required");
  if (!name) throw new Error("Contact name is required");
  if (name.length > 80) throw new Error("Contact name is too long");
  if (role && role.length > 80) throw new Error("Contact role is too long");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Contact email is invalid");
  if (phone && phone.length > 40) throw new Error("Contact phone is too long");
  if (!contactRelationStatuses.includes(input.relationStatus as ContactRelationStatus)) {
    throw new Error("Unsupported contact relation status");
  }

  return { clientId, name, role, email, phone, relationStatus: input.relationStatus as ContactRelationStatus };
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
