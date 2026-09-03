import "server-only";

import { render } from "@react-email/render";
import { Resend } from "resend";

import { QuoteEmail } from "@/emails/quote-email";

export type QuoteEmailDeliveryInput = { clientName: string; message: string; pdf: Buffer; quoteTitle: string; recipient: string; subject: string; versionNumber: number; idempotencyKey: string };

export function quoteEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.CORELOOM_QUOTE_FROM?.trim());
}

export async function deliverQuoteEmail(input: QuoteEmailDeliveryInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CORELOOM_QUOTE_FROM?.trim();
  if (!apiKey || !from) throw new Error("Quote email service is not configured");

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({ from, to: input.recipient, subject: input.subject, html: await render(QuoteEmail({ clientName: input.clientName, message: input.message, quoteTitle: input.quoteTitle, versionNumber: input.versionNumber })), attachments: [{ content: input.pdf, filename: `coreloom-quote-v${input.versionNumber}.pdf`, contentType: "application/pdf" }] }, { headers: { "Idempotency-Key": input.idempotencyKey } });
  if (error || !data?.id) throw new Error("Quote email provider rejected the request");
  return data.id;
}
