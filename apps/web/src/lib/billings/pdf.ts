import path from "node:path";

import PDFDocument from "pdfkit";

export type BillingPdfInput = {
  clientName: string;
  contractTitle: string;
  kindLabel: string;
  billingDate: string;
  dueDate: string;
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
  note?: string | null;
};

const koreanFontPath = path.join(process.cwd(), "node_modules", "@fontsource", "gowun-dodum", "files", "gowun-dodum-korean-400-normal.woff");

function won(value: number) { return `${value.toLocaleString("ko-KR")}원`; }

export function createBillingPdf(input: BillingPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 52, size: "A4" });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.registerFont("Korean", koreanFontPath);
    document.font("Korean").fontSize(11).fillColor("#173127").text("CORELOOM");
    document.moveDown(0.7);
    document.fontSize(24).fillColor("#17211c").text("청구서");
    document.moveDown(0.35);
    document.fontSize(12).text(input.contractTitle);
    document.moveDown(1.4);
    document.fontSize(10).fillColor("#68766f").text(`고객사  ${input.clientName}`);
    document.text(`구분  ${input.kindLabel}`);
    document.text(`청구일  ${input.billingDate}`);
    document.text(`입금 예정일  ${input.dueDate}`);
    document.moveDown(1.4);

    const amountX = 420;
    document.fillColor("#68766f").fontSize(9).text("항목", 52, document.y);
    document.text("공급가액", amountX, document.y - 11, { align: "right", width: 120 });
    document.moveDown(0.7);
    document.strokeColor("#d7ded9").moveTo(52, document.y).lineTo(543, document.y).stroke();
    document.moveDown(0.6);
    document.fillColor("#17211c").fontSize(10);
    const y = document.y;
    document.text(input.kindLabel, 52, y, { width: 340 });
    document.text(won(input.subtotalAmount), amountX, y, { align: "right", width: 120 });
    document.moveDown(1.1);
    document.strokeColor("#17211c").moveTo(343, document.y).lineTo(543, document.y).stroke();
    document.moveDown(0.7);
    const totals: Array<[string, number]> = [["공급가액", input.subtotalAmount], ["부가세 (10%)", input.vatAmount], ["합계", input.totalAmount]];
    for (const [label, amount] of totals) {
      const lineY = document.y;
      document.fontSize(label === "합계" ? 12 : 10).fillColor("#17211c").text(label, 343, lineY);
      document.text(won(amount), 420, lineY, { align: "right", width: 120 });
      document.moveDown(0.7);
    }

    if (input.note) {
      document.moveDown(1.2);
      document.strokeColor("#d7ded9").moveTo(52, document.y).lineTo(543, document.y).stroke();
      document.moveDown(0.7);
      document.fontSize(9).fillColor("#68766f").text(input.note, { width: 491 });
    }
    document.end();
  });
}
