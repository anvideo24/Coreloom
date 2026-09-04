import fs from "node:fs";
import path from "node:path";

import PDFDocument from "pdfkit";

import {
  formatQuoteDocumentNumber,
  quoteVatModeLabels,
  type QuoteCustomerItem,
  type QuoteVatMode,
} from "@/lib/domain/quotes";
import { quoteIssuerProfile } from "@/lib/quotes/issuer";

export type QuotePdfInput = {
  clientName: string;
  contactName?: string | null;
  title: string;
  versionNumber: number;
  items: QuoteCustomerItem[];
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatMode: QuoteVatMode;
  note?: string | null;
  issuedOn: Date;
  validUntil: Date;
};

const koreanFontPath = path.join(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "gowun-dodum",
  "files",
  "gowun-dodum-korean-400-normal.woff",
);

const PAGE_MARGIN = 52;
const CONTENT_RIGHT = 595.28 - PAGE_MARGIN;
const CONTENT_WIDTH = CONTENT_RIGHT - PAGE_MARGIN;
const ACCENT = quoteIssuerProfile.accentColor;
const INK = "#17211c";
const MUTED = "#68766f";
const RULE = "#d7ded9";

const COL = {
  title: { x: PAGE_MARGIN, w: 74 },
  desc: { x: PAGE_MARGIN + 78, w: 228 },
  qty: { x: PAGE_MARGIN + 310, w: 28 },
  unit: { x: PAGE_MARGIN + 342, w: 68 },
  amount: { x: PAGE_MARGIN + 414, w: CONTENT_WIDTH - 414 },
} as const;

function won(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function dash(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function hairline(document: InstanceType<typeof PDFDocument>, y: number) {
  document.strokeColor(RULE).lineWidth(0.5).moveTo(PAGE_MARGIN, y).lineTo(CONTENT_RIGHT, y).stroke();
}

function asCustomerLines(items: QuotePdfInput["items"]) {
  return items.map((item) => ({
    title: item.title,
    customerDescription: item.customerDescription ?? "",
    quantity: item.quantity > 0 ? item.quantity : 1,
    unitPrice: item.unitPrice > 0 ? item.unitPrice : item.amount,
    amount: item.amount,
  }));
}

export function createQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: PAGE_MARGIN, size: "A4" });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.registerFont("Korean", koreanFontPath);
    document.font("Korean");

    const issuedOn = input.issuedOn instanceof Date ? input.issuedOn : new Date(input.issuedOn);
    const validUntil = input.validUntil instanceof Date ? input.validUntil : new Date(input.validUntil);
    const documentNumber = formatQuoteDocumentNumber(input.versionNumber, issuedOn);
    const vatMode = input.vatMode ?? "exclusive";

    // Header: left title / right brand + meta
    const headerTop = PAGE_MARGIN;
    document.fillColor(INK).fontSize(22).text("INVOICE", PAGE_MARGIN, headerTop, { width: 260, lineGap: 1 });
    document
      .fillColor(MUTED)
      .fontSize(8)
      .text("아래와 같이 견적드립니다. 검토 후 회신 부탁드립니다.", PAGE_MARGIN, headerTop + 30, {
        width: 250,
        lineGap: 1,
      });

    const metaX = PAGE_MARGIN + 280;
    const metaW = CONTENT_WIDTH - 280;
    document.fillColor(ACCENT).fontSize(12).text(quoteIssuerProfile.brandName, metaX, headerTop, {
      width: metaW,
      align: "right",
    });
    let metaY = headerTop + 18;
    const metaRows: Array<[string, string]> = [
      ["견적번호", documentNumber],
      ["발행일", formatDate(issuedOn)],
      ["유효기간", formatDate(validUntil)],
    ];
    for (const [label, value] of metaRows) {
      document.fillColor(MUTED).fontSize(7).text(label, metaX, metaY, { width: 52 });
      document.fillColor(INK).fontSize(8).text(value, metaX + 52, metaY, { width: metaW - 52, align: "right" });
      metaY += 12;
    }

    let y = Math.max(headerTop + 58, metaY + 6);
    hairline(document, y);
    y += 12;

    // Recipient band
    document.fillColor(MUTED).fontSize(7).text("수신", PAGE_MARGIN, y);
    y += 11;
    document.fillColor(INK).fontSize(11).text(input.clientName, PAGE_MARGIN, y, { width: CONTENT_WIDTH });
    y += 15;
    if (input.contactName?.trim()) {
      document.fillColor(MUTED).fontSize(8).text(`담당자  ${input.contactName.trim()}`, PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
      });
      y += 12;
    }
    if (input.title.trim()) {
      document.fillColor(MUTED).fontSize(8).text(input.title.trim(), PAGE_MARGIN, y, { width: CONTENT_WIDTH });
      y += 12;
    }
    y += 4;
    hairline(document, y);
    y += 10;

    // Table header
    document.fillColor(MUTED).fontSize(7);
    document.text("항목", COL.title.x, y, { width: COL.title.w });
    document.text("설명", COL.desc.x, y, { width: COL.desc.w });
    document.text("수량", COL.qty.x, y, { width: COL.qty.w, align: "right" });
    document.text("단가", COL.unit.x, y, { width: COL.unit.w, align: "right" });
    document.text("공급가액", COL.amount.x, y, { width: COL.amount.w, align: "right" });
    y += 12;
    hairline(document, y);
    y += 8;

    const lines = asCustomerLines(input.items);
    for (const item of lines) {
      if (y > 700) {
        document.addPage();
        y = PAGE_MARGIN;
      }
      const rowTop = y;
      document.fillColor(INK).fontSize(8).text(item.title, COL.title.x, rowTop, {
        width: COL.title.w,
        lineGap: 1,
      });
      const titleBottom = document.y;
      document.fillColor(MUTED).fontSize(7).text(item.customerDescription || "—", COL.desc.x, rowTop, {
        width: COL.desc.w,
        lineGap: 1,
      });
      const descBottom = document.y;
      document.fillColor(INK).fontSize(8);
      document.text(String(item.quantity), COL.qty.x, rowTop, { width: COL.qty.w, align: "right" });
      document.text(won(item.unitPrice), COL.unit.x, rowTop, { width: COL.unit.w, align: "right" });
      document.text(won(item.amount), COL.amount.x, rowTop, { width: COL.amount.w, align: "right" });
      y = Math.max(titleBottom, descBottom, rowTop + 12) + 7;
    }

    y += 2;
    hairline(document, y);
    y += 10;

    // VAT note + optional freeform note
    document
      .fillColor(MUTED)
      .fontSize(7)
      .text(`상기 금액은 ${quoteVatModeLabels[vatMode]}입니다.`, PAGE_MARGIN, y, { width: CONTENT_WIDTH * 0.55 });
    if (input.note?.trim()) {
      y = document.y + 4;
      document.fillColor(MUTED).fontSize(7).text(input.note.trim(), PAGE_MARGIN, y, {
        width: CONTENT_WIDTH * 0.55,
        lineGap: 1,
      });
    }

    // Totals (right column)
    const totalsX = PAGE_MARGIN + 300;
    const totalsLabelW = 80;
    const totalsValueW = CONTENT_WIDTH - 300 - totalsLabelW;
    let totalsY = y;
    const totals: Array<[string, number, boolean]> = [
      ["공급가액", input.subtotalAmount, false],
      ["부가세", input.vatAmount, false],
      ["합계", input.totalAmount, true],
    ];
    for (const [label, amount, strong] of totals) {
      document.fillColor(strong ? INK : MUTED).fontSize(strong ? 10 : 8).text(label, totalsX, totalsY, {
        width: totalsLabelW,
      });
      document.fillColor(INK).fontSize(strong ? 10 : 8).text(won(amount), totalsX + totalsLabelW, totalsY, {
        width: totalsValueW,
        align: "right",
      });
      totalsY += strong ? 15 : 12;
    }

    y = Math.max(document.y, totalsY) + 12;
    if (y > 735) {
      document.addPage();
      y = PAGE_MARGIN;
    }
    hairline(document, y);
    y += 12;

    // Footer: payment | supplier
    const halfW = (CONTENT_WIDTH - 20) / 2;
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + halfW + 20;
    const footerTop = y;

    document.fillColor(MUTED).fontSize(7).text("입금 안내", leftX, footerTop);
    let leftY = footerTop + 11;
    const bankRows: Array<[string, string]> = [
      ["은행", dash(quoteIssuerProfile.bankName)],
      ["계좌", dash(quoteIssuerProfile.bankAccount)],
      ["예금주", dash(quoteIssuerProfile.accountHolder)],
      ["SWIFT", dash(quoteIssuerProfile.swift)],
    ];
    for (const [label, value] of bankRows) {
      document.fillColor(MUTED).fontSize(7).text(label, leftX, leftY, { width: 36 });
      document.fillColor(INK).fontSize(7).text(value, leftX + 40, leftY, { width: halfW - 40 });
      leftY += 11;
    }

    document.fillColor(MUTED).fontSize(7).text("공급자", rightX, footerTop);
    let rightY = footerTop + 11;
    document.fillColor(ACCENT).fontSize(11).text(quoteIssuerProfile.brandName, rightX, rightY, {
      width: halfW,
    });
    rightY += 14;
    document.fillColor(MUTED).fontSize(7).text("사업자등록번호", rightX, rightY, { width: halfW });
    rightY += 10;
    document.fillColor(INK).fontSize(8).text(dash(quoteIssuerProfile.businessRegistrationNumber), rightX, rightY, {
      width: halfW,
    });
    rightY += 11;
    document.fillColor(INK).fontSize(7).text(dash(quoteIssuerProfile.email), rightX, rightY, { width: halfW });
    rightY += 12;

    const signaturePath = path.join(process.cwd(), "public/brand/signature.png");
    try {
      if (fs.existsSync(signaturePath)) {
        document.image(signaturePath, rightX, rightY, { width: 84 });
      }
    } catch {
      // optional signature — ignore missing or unreadable image
    }

    document.end();
  });
}
