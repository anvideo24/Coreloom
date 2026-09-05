import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const token = (name: string) => css.match(new RegExp(`${name}:\\s*(#[a-f0-9]{6})`, "i"))?.[1];
function luminance(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

describe("shell small accent text", () => {
  test("uses a text-specific accent with at least 4.5 contrast on the canvas", () => {
    const foregroundToken = css.match(/\.auth-eyebrow\s*\{\s*color:\s*var\((--[\w-]+)\)/)?.[1];
    expect(foregroundToken).toBeDefined();
    const foreground = token(foregroundToken!);
    const background = token("--canvas");
    expect(foreground).toBeDefined();
    expect(background).toBeDefined();
    const a = luminance(foreground!), b = luminance(background!);
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
