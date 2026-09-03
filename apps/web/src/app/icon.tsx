import { ImageResponse } from "next/og";

import { CoreloomAppMark } from "@/lib/pwa/app-icon-mark";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<CoreloomAppMark fontSize={220} />, size);
}
