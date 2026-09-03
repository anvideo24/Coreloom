export type QuoteEmailDraftInput = { recipient: string; subject: string; message: string; approved: boolean };

export function normalizeQuoteEmailDraft(input: QuoteEmailDraftInput) {
  if (!input.approved) throw new Error("Representative approval is required");
  const recipient = input.recipient.trim();
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("Recipient email is invalid");
  if (!subject) throw new Error("Email subject is required");
  if (!message) throw new Error("Email message is required");
  return { recipient, subject, message };
}
