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
  title: { x: PAGE_MARGIN, w: 88 },
  desc: { x: PAGE_MARGIN + 92, w: 188 },
  qty: { x: PAGE_MARGIN + 284, w: 36 },
  unit: { x: PAGE_MARGIN + 324, w: 78 },
  amount: { x: PAGE_MARGIN + 406, w: CONTENT_WIDTH - 406 },
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
    document.fillColor(INK).fontSize(28).text("INVOICE", PAGE_MARGIN, headerTop, { width: 260, lineGap: 2 });
    document
      .fillColor(MUTED)
      .fontSize(9)
      .text("아래와 같이 견적드립니다. 검토 후 회신 부탁드립니다.", PAGE_MARGIN, headerTop + 38, {
        width: 260,
        lineGap: 2,
      });

    const metaX = PAGE_MARGIN + 280;
    const metaW = CONTENT_WIDTH - 280;
    document.fillColor(ACCENT).fontSize(14).text(quoteIssuerProfile.brandName, metaX, headerTop, {
      width: metaW,
      align: "right",
    });
    let metaY = headerTop + 22;
    const metaRows: Array<[string, string]> = [
      ["견적번호", documentNumber],
      ["발행일", formatDate(issuedOn)],
      ["유효기간", formatDate(validUntil)],
    ];
    for (const [label, value] of metaRows) {
      document.fillColor(MUTED).fontSize(8).text(label, metaX, metaY, { width: 56 });
      document.fillColor(INK).fontSize(9).text(value, metaX + 56, metaY, { width: metaW - 56, align: "right" });
      metaY += 14;
    }

    let y = Math.max(headerTop + 72, metaY + 8);
    hairline(document, y);
    y += 16;

    // Recipient band
    document.fillColor(MUTED).fontSize(8).text("수신", PAGE_MARGIN, y);
    y += 14;
    document.fillColor(INK).fontSize(12).text(input.clientName, PAGE_MARGIN, y, { width: CONTENT_WIDTH });
    y += 18;
    if (input.contactName?.trim()) {
      document.fillColor(MUTED).fontSize(9).text(`담당자  ${input.contactName.trim()}`, PAGE_MARGIN, y, {
        width: CONTENT_WIDTH,
      });
      y += 14;
    }
    if (input.title.trim()) {
      document.fillColor(MUTED).fontSize(9).text(input.title.trim(), PAGE_MARGIN, y, { width: CONTENT_WIDTH });
      y += 14;
    }
    y += 6;
    hairline(document, y);
    y += 12;

    // Table header
    document.fillColor(MUTED).fontSize(8);
    document.text("항목", COL.title.x, y, { width: COL.title.w });
    document.text("설명", COL.desc.x, y, { width: COL.desc.w });
    document.text("수량", COL.qty.x, y, { width: COL.qty.w, align: "right" });
    document.text("단가", COL.unit.x, y, { width: COL.unit.w, align: "right" });
    document.text("공급가액", COL.amount.x, y, { width: COL.amount.w, align: "right" });
    y += 14;
    hairline(document, y);
    y += 10;

    const lines = asCustomerLines(input.items);
    for (const item of lines) {
      if (y > 680) {
        document.addPage();
        y = PAGE_MARGIN;
      }
      const rowTop = y;
      document.fillColor(INK).fontSize(9).text(item.title, COL.title.x, rowTop, {
        width: COL.title.w,
        lineGap: 1,
      });
      const titleBottom = document.y;
      document.fillColor(MUTED).fontSize(8).text(item.customerDescription || "—", COL.desc.x, rowTop, {
        width: COL.desc.w,
        lineGap: 1,
      });
      const descBottom = document.y;
      document.fillColor(INK).fontSize(9);
      document.text(String(item.quantity), COL.qty.x, rowTop, { width: COL.qty.w, align: "right" });
      document.text(won(item.unitPrice), COL.unit.x, rowTop, { width: COL.unit.w, align: "right" });
      document.text(won(item.amount), COL.amount.x, rowTop, { width: COL.amount.w, align: "right" });
      y = Math.max(titleBottom, descBottom, rowTop + 14) + 10;
    }

    y += 4;
    hairline(document, y);
    y += 14;

    // VAT note + optional freeform note
    document
      .fillColor(MUTED)
      .fontSize(8)
      .text(`상기 금액은 ${quoteVatModeLabels[vatMode]}입니다.`, PAGE_MARGIN, y, { width: CONTENT_WIDTH * 0.55 });
    if (input.note?.trim()) {
      y = document.y + 6;
      document.fillColor(MUTED).fontSize(8).text(input.note.trim(), PAGE_MARGIN, y, {
        width: CONTENT_WIDTH * 0.55,
        lineGap: 2,
      });
    }

    // Totals (right column)
    const totalsX = PAGE_MARGIN + 300;
    const totalsLabelW = 90;
    const totalsValueW = CONTENT_WIDTH - 300 - totalsLabelW;
    let totalsY = y;
    const totals: Array<[string, number, boolean]> = [
      ["공급가액", input.subtotalAmount, false],
      ["부가세", input.vatAmount, false],
      ["합계", input.totalAmount, true],
    ];
    for (const [label, amount, strong] of totals) {
      document.fillColor(strong ? INK : MUTED).fontSize(strong ? 11 : 9).text(label, totalsX, totalsY, {
        width: totalsLabelW,
      });
      document.fillColor(INK).fontSize(strong ? 11 : 9).text(won(amount), totalsX + totalsLabelW, totalsY, {
        width: totalsValueW,
        align: "right",
      });
      totalsY += strong ? 18 : 15;
    }

    y = Math.max(document.y, totalsY) + 18;
    if (y > 720) {
      document.addPage();
      y = PAGE_MARGIN;
    }
    hairline(document, y);
    y += 16;

    // Footer: payment | supplier
    const halfW = (CONTENT_WIDTH - 24) / 2;
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + halfW + 24;
    const footerTop = y;

    document.fillColor(MUTED).fontSize(8).text("입금 안내", leftX, footerTop);
    let leftY = footerTop + 14;
    const bankRows: Array<[string, string]> = [
      ["은행", dash(quoteIssuerProfile.bankName)],
      ["계좌", dash(quoteIssuerProfile.bankAccount)],
      ["예금주", dash(quoteIssuerProfile.accountHolder)],
      ["SWIFT", dash(quoteIssuerProfile.swift)],
    ];
    for (const [label, value] of bankRows) {
      document.fillColor(MUTED).fontSize(8).text(label, leftX, leftY, { width: 40 });
      document.fillColor(INK).fontSize(8).text(value, leftX + 44, leftY, { width: halfW - 44 });
      leftY += 13;
    }

    document.fillColor(MUTED).fontSize(8).text("공급자", rightX, footerTop);
    let rightY = footerTop + 14;
    document.fillColor(ACCENT).fontSize(12).text(quoteIssuerProfile.brandName, rightX, rightY, {
      width: halfW,
    });
    rightY += 18;
    document.fillColor(MUTED).fontSize(8).text("사업자등록번호", rightX, rightY, { width: halfW });
    rightY += 12;
    document.fillColor(INK).fontSize(9).text(dash(quoteIssuerProfile.businessRegistrationNumber), rightX, rightY, {
      width: halfW,
    });
    rightY += 14;
    document.fillColor(INK).fontSize(8).text(dash(quoteIssuerProfile.email), rightX, rightY, { width: halfW });
    rightY += 16;

    const signaturePath = path.join(process.cwd(), "public/brand/signature.png");
    try {
      if (fs.existsSync(signaturePath)) {
        document.image(signaturePath, rightX, rightY, { width: 96 });
      }
    } catch {
      // optional signature — ignore missing or unreadable image
    }

    document.end();
  });
}
