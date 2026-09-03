import { isOfficialDecision } from "@/lib/domain/ai-proposals";
import { groupEvidenceByOccurredDate } from "@/lib/domain/recho-evidence";

export type ProjectWorkspaceLink = {
  href: string;
  title: string;
  detail: string;
  amount?: number;
};

function keepFirstBy<T>(items: T[], key: (item: T) => string) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}

export function buildProjectWorkspace(input: {
  project: {
    id: string;
    name: string;
    clientName: string;
    status: string;
    statusLabel: string;
    progressPercent: number;
  };
  contacts: Array<{ id: string; name: string; role: string | null; detail: string }>;
  tasks: Array<{ id: string; title: string; dueDate: string; statusLabel: string; status: string; agentName?: string | null }>;
  quotes: Array<{ quoteId: string; versionNumber: number; title: string; totalAmount: number }>;
  contracts: Array<{ contractId: string; versionNumber: number; title: string; statusLabel: string; totalAmount: number }>;
  billings: Array<{ id: string; kindLabel: string; amount: number; dueDate: string; statusLabel: string }>;
  documents: Array<{ documentId: string; versionNumber: number; title: string; kindLabel: string }>;
  evidence: Array<{
    id: string;
    title: string;
    kindLabel: string;
    occurredOn: string;
    occurredTime: string;
    originalUrl: string | null;
    linkReason: string;
  }>;
  proposals: Array<{
    id: string;
    evidenceId: string;
    kindLabel: string;
    body: string;
    status: string;
    statusLabel: string;
  }>;
}) {
  const quotes = keepFirstBy(input.quotes, (item) => item.quoteId).map((item) => ({
    href: `/quotes/${item.quoteId}`,
    title: item.title,
    detail: `v${item.versionNumber}`,
    amount: item.totalAmount,
  }));
  const contracts = keepFirstBy(input.contracts, (item) => item.contractId).map((item) => ({
    href: `/contracts/${item.contractId}`,
    title: item.title,
    detail: `v${item.versionNumber} · ${item.statusLabel}`,
    amount: item.totalAmount,
  }));
  const documents = keepFirstBy(input.documents, (item) => item.documentId).map((item) => ({
    href: `/documents/${item.documentId}`,
    title: item.title,
    detail: `${item.kindLabel} · v${item.versionNumber}`,
  }));
  const tasks = [...input.tasks]
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .map((item) => ({
      href: `/tasks/${item.id}`,
      title: item.title,
      detail: `기한 ${item.dueDate} · ${item.statusLabel}${item.agentName ? ` · ${item.agentName}` : ""}`,
    }));
  const billings = [...input.billings]
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .map((item) => ({
      href: `/billings/${item.id}`,
      title: item.kindLabel,
      detail: `예정 ${item.dueDate} · ${item.statusLabel}`,
      amount: item.amount,
    }));

  const proposalsByEvidence = new Map<string, typeof input.proposals>();
  for (const proposal of input.proposals) {
    const existing = proposalsByEvidence.get(proposal.evidenceId) ?? [];
    existing.push(proposal);
    proposalsByEvidence.set(proposal.evidenceId, existing);
  }

  const timeline = groupEvidenceByOccurredDate(input.evidence).map((group) => ({
    occurredOn: group.occurredOn,
    records: group.records.map((record) => ({
      id: record.id,
      href: `/timeline/${record.id}`,
      title: record.title,
      detail: `${record.kindLabel} · ${record.occurredTime}`,
      originalUrl: record.originalUrl,
      linkReason: record.linkReason,
      proposals: (proposalsByEvidence.get(record.id) ?? []).map((proposal) => ({
        href: `/proposals/${proposal.id}`,
        title: proposal.body,
        detail: `${proposal.kindLabel} · ${isOfficialDecision(proposal.status) ? "공식 결정" : "공식 결정 아님"}`,
        statusLabel: proposal.statusLabel,
      })),
    })),
  }));

  return {
    project: input.project,
    contacts: input.contacts,
    progressPercent: input.project.progressPercent,
    tasks,
    quotes,
    contracts,
    billings,
    documents,
    timeline,
  };
}
