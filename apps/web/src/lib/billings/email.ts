import "server-only";

import { render } from "@react-email/render";
import { Resend } from "resend";

import { BillingEmail } from "@/emails/billing-email";
import { quoteEmailConfigured } from "@/lib/quotes/email";

export type BillingEmailDeliveryInput = {
  clientName: string;
  contractTitle: string;
  kindLabel: string;
  message: string;
  pdf: Buffer;
  recipient: string;
  subject: string;
  idempotencyKey: string;
};

export function billingEmailConfigured() {
  return quoteEmailConfigured();
}

export async function deliverBillingEmail(input: BillingEmailDeliveryInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CORELOOM_QUOTE_FROM?.trim();
  if (!apiKey || !from) throw new Error("Billing email service is not configured");

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: input.recipient,
    subject: input.subject,
    html: await render(BillingEmail({
      clientName: input.clientName,
      contractTitle: input.contractTitle,
      kindLabel: input.kindLabel,
      message: input.message,
    })),
    attachments: [{ content: input.pdf, filename: "coreloom-invoice.pdf", contentType: "application/pdf" }],
  }, { headers: { "Idempotency-Key": input.idempotencyKey } });
  if (error || !data?.id) throw new Error("Billing email provider rejected the request");
  return data.id;
}
