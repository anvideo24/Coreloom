import { describe, expect, it } from "vitest";
import { normalizeChatImage } from "@/lib/agents/chat-image-codec";
import sharp from "sharp";

describe("chat image validation", () => {
  it("decodes and normalizes a real image, not a claimed MIME type", async () => {
    const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: "red" } }).png().toBuffer();
    const result = await normalizeChatImage(png);
    expect((await sharp(result).metadata()).format).toBe("webp");
  });
  it("rejects scripts and oversized input", async () => {
    await expect(normalizeChatImage(Buffer.from("<svg onload='alert(1)'/>"))).rejects.toThrow();
    await expect(normalizeChatImage(Buffer.alloc(8 * 1024 * 1024 + 1))).rejects.toThrow();
  });
});
