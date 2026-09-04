import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { listFounderAiProposals } from "@/lib/ai-proposals/repository";
import { listFounderBillings } from "@/lib/billings/repository";
import { listFounderContracts } from "@/lib/contracts/repository";
import { createDatabase } from "@/lib/db/client";
import { aiAgentWorkLogs, aiAgents } from "@/lib/db/schema";
import { billingKindLabels } from "@/lib/domain/billings";
import { aiProposalKindLabels } from "@/lib/domain/ai-proposals";
import { buildApprovalInbox, summarizeApprovals } from "@/lib/domain/approvals";
import { listFounderExpenseLedger } from "@/lib/expenses/repository";
import { listFounderRevenueLedger } from "@/lib/revenue/repository";
import { ensureFounderWorkspace } from "@/lib/workspace/founder-workspace";

export async function listPendingAgentWorks(authUserId: string) {
  const workspace = await ensureFounderWorkspace(authUserId, "approvals");
  const database = createDatabase();
  return database
    .select({
      id: aiAgentWorkLogs.id,
      agentId: aiAgentWorkLogs.agentId,
      agentName: aiAgents.name,
      requestNote: aiAgentWorkLogs.requestNote,
      createdAt: aiAgentWorkLogs.createdAt,
    })
    .from(aiAgentWorkLogs)
    .innerJoin(aiAgents, eq(aiAgentWorkLogs.agentId, aiAgents.id))
    .where(and(
      eq(aiAgentWorkLogs.workspaceId, workspace.id),
      eq(aiAgentWorkLogs.status, "pending"),
    ))
    .orderBy(desc(aiAgentWorkLogs.createdAt));
}

export async function listFounderApprovalInbox(authUserId: string) {
  const [expenses, revenue, billings, contracts, proposals, agentWorks] = await Promise.all([
    listFounderExpenseLedger(authUserId),
    listFounderRevenueLedger(authUserId),
    listFounderBillings(authUserId),
    listFounderContracts(authUserId),
    listFounderAiProposals(authUserId),
    listPendingAgentWorks(authUserId),
  ]);

  const items = buildApprovalInbox({
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
    items,
    summary: summarizeApprovals(items),
  };
}
