import "server-only";

import { eq } from "drizzle-orm";

import { listFounderAiProposals } from "@/lib/ai-proposals/repository";
import { listPendingAgentWorks } from "@/lib/approvals/repository";
import { listFounderBillings } from "@/lib/billings/repository";
import { listFounderClientsAndProjects } from "@/lib/clients-projects/repository";
import { listFounderCompanySetup } from "@/lib/company-setup/repository";
import { listFounderContracts } from "@/lib/contracts/repository";
import { createDatabase } from "@/lib/db/client";
import { quoteEmailDeliveries } from "@/lib/db/schema";
import { listFounderVaultDocuments } from "@/lib/documents/repository";
import { aiProposalKindLabels, aiProposalStatusLabels } from "@/lib/domain/ai-proposals";
import { buildApprovalInbox } from "@/lib/domain/approvals";
import { billingKindLabels } from "@/lib/domain/billings";
import { buildFounderDashboard, calendarDateInTimeZone } from "@/lib/domain/dashboard";
import { listFounderExpenseLedger } from "@/lib/expenses/repository";
import { listFounderQuotes } from "@/lib/quotes/repository";
import { listFounderRevenueLedger } from "@/lib/revenue/repository";
import { listFounderTasks } from "@/lib/tasks/repository";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function getFounderDashboard(authUserId: string, now = new Date()) {
  const workspace = await ensureFounderWorkspace(authUserId, "dashboard");
  const [
    setup,
    quotes,
    contracts,
    billings,
    proposals,
    clientsProjects,
    revenue,
    expenses,
    tasks,
    documents,
    agentWorks,
  ] = await Promise.all([
    listFounderCompanySetup(authUserId),
    listFounderQuotes(authUserId),
    listFounderContracts(authUserId),
    listFounderBillings(authUserId),
    listFounderAiProposals(authUserId),
    listFounderClientsAndProjects(authUserId),
    listFounderRevenueLedger(authUserId),
    listFounderExpenseLedger(authUserId),
    listFounderTasks(authUserId),
    listFounderVaultDocuments(authUserId),
    listPendingAgentWorks(authUserId),
  ]);

  const latestQuotes = [];
  const seenQuotes = new Set<string>();
  for (const row of quotes.versions) {
    if (seenQuotes.has(row.quoteId)) continue;
    seenQuotes.add(row.quoteId);
    latestQuotes.push(row);
  }

  const deliveries = await createDatabase().select({
    quoteVersionId: quoteEmailDeliveries.quoteVersionId,
    status: quoteEmailDeliveries.status,
  }).from(quoteEmailDeliveries)
    .where(eq(quoteEmailDeliveries.workspaceId, workspace.id));
  const emailRequested = new Set(
    deliveries
      .filter((row) => row.status === "accepted" || row.status === "pending")
      .map((row) => row.quoteVersionId),
  );

  const recentDecisions = [...proposals.decided].sort((left, right) => {
    const leftTime = left.decidedAt?.getTime() ?? left.createdAt.getTime();
    const rightTime = right.decidedAt?.getTime() ?? right.createdAt.getTime();
    return rightTime - leftTime;
  });

  const dashboard = buildFounderDashboard({
    today: calendarDateInTimeZone(now),
    setupItems: setup.items.map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      evidenceReference: item.evidenceReference,
    })),
    quotes: latestQuotes.map((item) => ({
      quoteId: item.quoteId,
      versionId: item.versionId,
      versionNumber: item.versionNumber,
      title: item.title,
      clientName: item.clientName,
      projectId: item.projectId ?? null,
      totalAmount: item.totalAmount,
      emailRequested: emailRequested.has(item.versionId),
    })),
    contracts: contracts.contracts.map((item) => ({
      contractId: item.contractId,
      title: item.title,
      clientName: item.clientName,
      projectId: item.projectId ?? null,
      status: item.status,
      totalAmount: item.totalAmount,
    })),
    billings: billings.billings.map((item) => ({
      id: item.id,
      clientName: item.clientName,
      contractTitle: item.contractTitle,
      kindLabel: billingKindLabels[item.kind],
      amount: item.amount,
      billingDate: item.billingDate,
      dueDate: item.dueDate,
      projectId: item.projectId ?? null,
      status: item.status,
    })),
    pendingProposals: proposals.pending.map((item) => ({
      id: item.id,
      kindLabel: aiProposalKindLabels[item.kind],
      body: item.body,
      clientName: item.clientName,
      projectName: item.projectName,
    })),
    projects: clientsProjects.projects.map((item) => ({
      id: item.id,
      name: item.name,
      clientName: item.clientName,
      status: item.status,
      progressPercent: item.progressPercent,
    })),
    revenue: revenue.summary,
    expenses: expenses.rows.map((item) => ({
      id: item.id,
      title: item.title,
      counterparty: item.counterparty,
      amount: item.amount,
      settlementDate: item.settlementDate,
      status: item.status,
      unclassified: item.unclassified,
    })),
    tasks: tasks.tasks.map((item) => ({
      id: item.id,
      title: item.title,
      dueDate: item.dueDate,
      status: item.status,
      clientName: item.clientName,
      projectName: item.projectName,
    })),
    recentDecisions: recentDecisions.map((item) => ({
      id: item.id,
      kindLabel: aiProposalKindLabels[item.kind],
      body: item.body,
      statusLabel: aiProposalStatusLabels[item.status],
      clientName: item.clientName,
      projectName: item.projectName,
    })),
    documentCount: documents.documents.length,
  });

  const approvalItems = buildApprovalInbox({
    expenses: expenses.rows,
    revenueEntries: revenue.rows.map((row) => ({
      id: row.id.replace(/^revenue:/, ""),
      href: row.href,
      title: row.title,
      counterparty: row.counterparty,
      amount: row.amount,
      settlementDate: row.settlementDate,
      status: row.status,
      source: row.source,
    })),
    billings: billings.billings.map((item) => ({
      id: item.id,
      clientName: item.clientName,
      contractTitle: item.contractTitle,
      kindLabel: billingKindLabels[item.kind],
      amount: item.amount,
      dueDate: item.dueDate,
      status: item.status,
    })),
    contracts: contracts.contracts.map((item) => ({
      contractId: item.contractId,
      title: item.title,
      clientName: item.clientName,
      status: item.status,
      totalAmount: item.totalAmount,
    })),
    proposals: proposals.pending.map((item) => ({
      id: item.id,
      kindLabel: aiProposalKindLabels[item.kind],
      body: item.body,
      clientName: item.clientName,
      projectName: item.projectName,
    })),
    agentWorks: agentWorks.map((item) => ({
      id: item.id,
      agentId: item.agentId,
      agentName: item.agentName,
      requestNote: item.requestNote,
      createdAt: item.createdAt.toISOString(),
    })),
  });

  return {
    ...dashboard,
    vitals: {
      ...dashboard.vitals,
      pendingApprovals: approvalItems.length,
    },
  };
}
