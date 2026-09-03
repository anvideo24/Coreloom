import { NextResponse } from "next/server";

import { founderSession } from "@/lib/auth/session";
import { getFounderBillingDetail } from "@/lib/billings/repository";
import { createBillingPdf } from "@/lib/billings/pdf";
import { billingKindLabels, calculateBillingInvoiceAmounts } from "@/lib/domain/billings";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ billingId: string }> }) {
  const session = await founderSession();
  if (session.state === "signed-out") return NextResponse.redirect(new URL("/sign-in", request.url));
  if (session.state === "denied") return NextResponse.redirect(new URL("/dashboard", request.url));

  const { billingId } = await params;
  const detail = await getFounderBillingDetail(session.founder.id, billingId);
  if (!detail) return new NextResponse("Not found", { status: 404 });
  const { billing } = detail;
  const invoice = calculateBillingInvoiceAmounts(billing.amount);
  const pdf = await createBillingPdf({
    clientName: billing.clientName,
    contractTitle: detail.contractTitle,
    kindLabel: billingKindLabels[billing.kind],
    billingDate: billing.billingDate,
    dueDate: billing.dueDate,
    subtotalAmount: invoice.subtotalAmount,
    vatAmount: invoice.vatAmount,
    totalAmount: invoice.totalAmount,
    note: billing.note,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Disposition": `attachment; filename=coreloom-invoice-${billing.kind}.pdf`,
      "Content-Type": "application/pdf",
    },
  });
}
