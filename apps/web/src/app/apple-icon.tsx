import { ImageResponse } from "next/og";

import { CoreloomAppMark } from "@/lib/pwa/app-icon-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<CoreloomAppMark fontSize={84} />, size);
}
