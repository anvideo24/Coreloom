import sharp from "sharp";

export const chatImageByteLimit = 8 * 1024 * 1024;
export async function normalizeChatImage(input: Buffer) {
  if (!input.length || input.length > chatImageByteLimit) throw new Error("이미지는 8MB 이하만 첨부할 수 있습니다.");
  const image = sharp(input, { limitInputPixels: 20_000_000, animated: false });
  const metadata = await image.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format || "") || (metadata.pages || 1) > 1) throw new Error("PNG·JPG·WebP 정지 이미지만 지원합니다.");
  const output = await image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  if (output.length > 4 * 1024 * 1024) throw new Error("이미지가 너무 큽니다.");
  return output;
}

export async function boundedImageBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("이미지가 없습니다.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > chatImageByteLimit) { await reader.cancel(); throw new Error("이미지가 너무 큽니다."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
