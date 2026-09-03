import { describe, expect, it } from "vitest";

import {
  allowedDevelopmentOrigins,
  isPrivateIPv4,
  isTailscaleIPv4,
  lanListenAddresses,
  LOCAL_MDNS_PATTERN,
  TAILSCALE_MAGICDNS_PATTERN,
} from "@/lib/pwa/dev-origins";
import { tailscaleFunnelArgs } from "@/lib/pwa/tailscale-funnel";
import { coreloomWebManifest } from "@/lib/pwa/web-manifest";

describe("private development origins", () => {
  it("accepts loopback, LAN, and Tailscale addresses and rejects public ones", () => {
    expect(isPrivateIPv4("127.0.0.1")).toBe(true);
    expect(isPrivateIPv4("192.168.0.10")).toBe(true);
    expect(isPrivateIPv4("10.0.0.5")).toBe(true);
    expect(isPrivateIPv4("172.16.1.1")).toBe(true);
    expect(isTailscaleIPv4("100.64.0.1")).toBe(true);
    expect(isPrivateIPv4("100.64.0.1")).toBe(true);
    expect(isPrivateIPv4("8.8.8.8")).toBe(false);
    expect(isTailscaleIPv4("192.168.0.10")).toBe(false);
  });

  it("allows MagicDNS, LAN, and optional extra hosts without public addresses", () => {
    expect(allowedDevelopmentOrigins({
      addresses: ["8.8.8.8", "127.0.0.1", "192.168.0.10", "100.101.2.3"],
      machineName: "Office-PC",
      extraOrigins: "https://office.ts.net, extra.ts.net:3000",
    })).toEqual([
      TAILSCALE_MAGICDNS_PATTERN,
      LOCAL_MDNS_PATTERN,
      "office-pc",
      "office-pc.local",
      "127.0.0.1",
      "192.168.0.10",
      "100.101.2.3",
      "office.ts.net",
      "extra.ts.net:3000",
    ]);
  });

  it("prints LAN listen addresses without localhost", () => {
    expect(lanListenAddresses(["127.0.0.1", "192.168.0.10", "8.8.8.8"])).toEqual(["192.168.0.10"]);
  });
});

describe("Coreloom web app manifest", () => {
  it("opens as a standalone Korean app on the dashboard", () => {
    expect(coreloomWebManifest()).toMatchObject({
      name: "Coreloom",
      short_name: "Coreloom",
      start_url: "/dashboard",
      display: "standalone",
      lang: "ko",
      theme_color: "#0b684c",
    });
  });

  it("opens a phone URL with Funnel instead of requiring Tailscale on the phone", () => {
    expect(tailscaleFunnelArgs()).toEqual(["funnel", "--bg", "--yes", "3000"]);
  });
});
