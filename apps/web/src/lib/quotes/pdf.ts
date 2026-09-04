import path from "node:path";

import PDFDocument from "pdfkit";

type QuotePdfItem = { description: string; amount: number };

export type QuotePdfInput = {
  clientName: string;
  title: string;
  versionNumber: number;
  items: QuotePdfItem[];
  subtotalAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatMode?: "exclusive" | "inclusive";
  note?: string | null;
};

const koreanFontPath = path.join(process.cwd(), "node_modules", "@fontsource", "gowun-dodum", "files", "gowun-dodum-korean-400-normal.woff");

function won(value: number) { return `${value.toLocaleString("ko-KR")}원`; }

export function createQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 52, size: "A4" });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.registerFont("Korean", koreanFontPath);
    document.font("Korean").fontSize(11).fillColor("#173127").text("CORELOOM");
    document.moveDown(0.7);
    document.fontSize(24).fillColor("#17211c").text("견적서");
    document.moveDown(0.35);
    document.fontSize(12).text(input.title);
    document.moveDown(1.4);
    document.fontSize(10).fillColor("#68766f").text(`고객사  ${input.clientName}`);
    document.text(`버전  v${input.versionNumber}`);
    document.moveDown(1.4);

    const amountX = 420;
    const amountLabel = input.vatMode === "inclusive" ? "금액(부가세 포함)" : "공급가액";
    document.fillColor("#68766f").fontSize(9).text("항목", 52, document.y);
    document.text(amountLabel, amountX, document.y - 11, { align: "right", width: 120 });
    document.moveDown(0.7);
    document.strokeColor("#d7ded9").moveTo(52, document.y).lineTo(543, document.y).stroke();
    document.moveDown(0.6);
    document.fillColor("#17211c").fontSize(10);
    for (const item of input.items) {
      const y = document.y;
      document.text(item.description, 52, y, { width: 340 });
      document.text(won(item.amount), amountX, y, { align: "right", width: 120 });
      document.moveDown(0.8);
    }

    document.moveDown(1.1);
    document.strokeColor("#17211c").moveTo(343, document.y).lineTo(543, document.y).stroke();
    document.moveDown(0.7);
    const totals: Array<[string, number]> = input.vatMode === "inclusive"
      ? [["공급가액(역산)", input.subtotalAmount], ["부가세 (포함분)", input.vatAmount], ["합계", input.totalAmount]]
      : [["공급가액", input.subtotalAmount], ["부가세 (10%)", input.vatAmount], ["합계", input.totalAmount]];
    for (const [label, amount] of totals) {
      const y = document.y;
      document.fontSize(label === "합계" ? 12 : 10).fillColor("#17211c").text(label, 343, y);
      document.text(won(amount), 420, y, { align: "right", width: 120 });
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
