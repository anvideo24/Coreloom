import type { MetadataRoute } from "next";

export function coreloomWebManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Coreloom",
    short_name: "Coreloom",
    description: "대표 전용 비공개 운영 본부",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f3eee6",
    theme_color: "#1c1916",
    lang: "ko",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
