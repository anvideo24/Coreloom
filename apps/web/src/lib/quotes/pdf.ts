import fs from "node:fs";
import path from "node:path";

import PDFDocument from "pdfkit";

import {
  formatQuoteDocumentNumber,
  quoteInvoiceMaxLineItems,
  quoteVatModeLabels,
  type QuoteCustomerItem,
  type QuoteVatMode,
} from "@/lib/domain/quotes";
import {
  resolveQuoteIssuerProfile,
  type QuoteIssuerProfile,
  type WorkspaceCompanyProfileInput,
} from "@/lib/quotes/issuer";

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
  issuer?: QuoteIssuerProfile | WorkspaceCompanyProfileInput | null;
};

const koreanFontPath = path.join(
  process.cwd(),
  "node_modules",
  "@fontsource",
  "gowun-dodum",
  "files",
  "gowun-dodum-korean-400-normal.woff",
);

const PAGE_MARGIN = 48;
const PAGE_BOTTOM = 841.89 - PAGE_MARGIN;
const CONTENT_RIGHT = 595.28 - PAGE_MARGIN;
const CONTENT_WIDTH = CONTENT_RIGHT - PAGE_MARGIN;
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

const ROW_HEIGHT = 22;
const TABLE_BODY_TOP_GAP = 8;

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
  return items.slice(0, quoteInvoiceMaxLineItems).map((item) => ({
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

    const issuer = resolveQuoteIssuerProfile(input.issuer);
    const ACCENT = issuer.accentColor;
    const issuedOn = input.issuedOn instanceof Date ? input.issuedOn : new Date(input.issuedOn);
    const validUntil = input.validUntil instanceof Date ? input.validUntil : new Date(input.validUntil);
    const documentNumber = formatQuoteDocumentNumber(input.versionNumber, issuedOn);
    const vatMode = input.vatMode ?? "exclusive";

    const headerTop = PAGE_MARGIN;
    document.fillColor(INK).fontSize(22).text("INVOICE", PAGE_MARGIN, headerTop, { width: 260, lineGap: 1 });
    document
      .fillColor(MUTED)
      .fontSize(8)
      .text("아래와 같이 견적드립니다.\n검토 후 회신 부탁드립니다.", PAGE_MARGIN, headerTop + 28, {
        width: 250,
        lineGap: 2,
      });

    const metaX = PAGE_MARGIN + 280;
    const metaW = CONTENT_WIDTH - 280;
    document.fillColor(ACCENT).fontSize(12).text(issuer.brandName, metaX, headerTop, {
      width: metaW,
      align: "right",
    });
    let metaY = headerTop + 18;
    for (const [label, value] of [
      ["견적번호", documentNumber],
      ["발행일", formatDate(issuedOn)],
      ["유효기간", formatDate(validUntil)],
    ] as const) {
      document.fillColor(MUTED).fontSize(7).text(label, metaX, metaY, { width: 52 });
      document.fillColor(INK).fontSize(8).text(value, metaX + 52, metaY, { width: metaW - 52, align: "right" });
      metaY += 12;
    }

    let y = Math.max(headerTop + 58, metaY + 6);
    hairline(document, y);
    y += 12;

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

    document.fillColor(MUTED).fontSize(7);
    document.text("항목", COL.title.x, y, { width: COL.title.w });
    document.text("설명", COL.desc.x, y, { width: COL.desc.w });
    document.text("수량", COL.qty.x, y, { width: COL.qty.w, align: "right" });
    document.text("단가", COL.unit.x, y, { width: COL.unit.w, align: "right" });
    document.text("공급가액", COL.amount.x, y, { width: COL.amount.w, align: "right" });
    y += 12;
    hairline(document, y);
    y += TABLE_BODY_TOP_GAP;

    const tableTop = y;
    const lines = asCustomerLines(input.items);
    for (let index = 0; index < quoteInvoiceMaxLineItems; index += 1) {
      const rowTop = tableTop + index * ROW_HEIGHT;
      const item = lines[index];
      if (item) {
        document.fillColor(INK).fontSize(8).text(item.title, COL.title.x, rowTop, {
          width: COL.title.w,
          lineGap: 1,
          height: ROW_HEIGHT - 4,
          ellipsis: true,
        });
        document.fillColor(MUTED).fontSize(7).text(item.customerDescription || "—", COL.desc.x, rowTop, {
          width: COL.desc.w,
          lineGap: 1,
          height: ROW_HEIGHT - 4,
          ellipsis: true,
        });
        document.fillColor(INK).fontSize(7);
        document.text(String(item.quantity), COL.qty.x, rowTop, { width: COL.qty.w, align: "right" });
        document.text(won(item.unitPrice), COL.unit.x, rowTop, { width: COL.unit.w, align: "right" });
        document.text(won(item.amount), COL.amount.x, rowTop, { width: COL.amount.w, align: "right" });
      }
      hairline(document, rowTop + ROW_HEIGHT - 4);
    }

    // Bottom-fixed summary + footer
    const footerBlockHeight = 118;
    const summaryBlockHeight = 58;
    let bottomY = PAGE_BOTTOM - footerBlockHeight - summaryBlockHeight;
    hairline(document, bottomY);
    bottomY += 10;

    document
      .fillColor(MUTED)
      .fontSize(7)
      .text(`상기 금액은 ${quoteVatModeLabels[vatMode]}입니다.`, PAGE_MARGIN, bottomY, {
        width: CONTENT_WIDTH * 0.52,
      });
    if (input.note?.trim()) {
      document.fillColor(MUTED).fontSize(7).text(input.note.trim(), PAGE_MARGIN, bottomY + 12, {
        width: CONTENT_WIDTH * 0.52,
        lineGap: 1,
        height: 28,
        ellipsis: true,
      });
    }

    const totalsX = PAGE_MARGIN + 300;
    const totalsLabelW = 80;
    const totalsValueW = CONTENT_WIDTH - 300 - totalsLabelW;
    let totalsY = bottomY;
    for (const [label, amount, strong] of [
      ["공급가액", input.subtotalAmount, false],
      ["부가세", input.vatAmount, false],
      ["합계", input.totalAmount, true],
    ] as Array<[string, number, boolean]>) {
      document.fillColor(strong ? INK : MUTED).fontSize(strong ? 10 : 7.5).text(label, totalsX, totalsY, {
        width: totalsLabelW,
      });
      document
        .fillColor(INK)
        .fontSize(strong ? 10 : 7.5)
        .text(won(amount), totalsX + totalsLabelW, totalsY, { width: totalsValueW, align: "right" });
      totalsY += strong ? 14 : 11;
    }

    bottomY = PAGE_BOTTOM - footerBlockHeight;
    hairline(document, bottomY);
    bottomY += 10;

    const halfW = (CONTENT_WIDTH - 20) / 2;
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + halfW + 20;

    document.fillColor(MUTED).fontSize(7).text("입금 안내", leftX, bottomY);
    let leftY = bottomY + 11;
    for (const [label, value] of [
      ["은행", dash(issuer.bankName)],
      ["계좌", dash(issuer.bankAccount)],
      ["예금주", dash(issuer.accountHolder)],
      ["SWIFT", dash(issuer.swift)],
    ] as const) {
      document.fillColor(MUTED).fontSize(7).text(label, leftX, leftY, { width: 36 });
      document.fillColor(INK).fontSize(7).text(value, leftX + 40, leftY, { width: halfW - 40 });
      leftY += 11;
    }

    document.fillColor(MUTED).fontSize(7).text("공급자", rightX, bottomY);
    let rightY = bottomY + 11;
    document.fillColor(ACCENT).fontSize(11).text(issuer.brandName, rightX, rightY, { width: halfW });
    rightY += 14;
    document.fillColor(MUTED).fontSize(7).text("사업자등록번호", rightX, rightY, { width: halfW });
    rightY += 10;
    document.fillColor(INK).fontSize(8).text(dash(issuer.businessRegistrationNumber), rightX, rightY, {
      width: halfW,
    });
    rightY += 11;
    if (issuer.representativeName) {
      document.fillColor(MUTED).fontSize(7).text("대표", rightX, rightY, { width: 28 });
      document.fillColor(INK).fontSize(7).text(issuer.representativeName, rightX + 30, rightY, {
        width: halfW - 30,
      });
      rightY += 11;
    }
    document.fillColor(INK).fontSize(7).text(dash(issuer.email), rightX, rightY, { width: halfW });
    rightY += 12;

    const signaturePath = path.join(
      process.cwd(),
      issuer.signatureSrc.startsWith("/") ? `public${issuer.signatureSrc}` : issuer.signatureSrc,
    );
    try {
      if (fs.existsSync(signaturePath)) {
        document.image(signaturePath, rightX, rightY, { width: 84 });
      }
    } catch {
      // optional signature
    }

    document.end();
  });
}
