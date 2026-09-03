export const projectStatuses = ["planned", "active", "on_hold", "complete"] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export function normalizeClientName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error("Client name is required");
  if (name.length > 120) throw new Error("Client name is too long");
  return name;
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
