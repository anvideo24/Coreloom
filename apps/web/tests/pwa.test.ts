import { describe, expect, it } from "vitest";

import {
  allowedDevelopmentOrigins,
  isPrivateIPv4,
  isTailscaleIPv4,
  lanListenAddresses,
  LOCAL_MDNS_PATTERN,
  TAILSCALE_MAGICDNS_PATTERN,
} from "@/lib/pwa/dev-origins";
import { decideLocalMainSync, formatLocalUpBanner, PC_DEV_DASHBOARD } from "@/lib/pwa/local-up";
import { funnelAuthDomainHint, funnelHttpsOrigins, tailscaleFunnelArgs } from "@/lib/pwa/tailscale-funnel";
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

  it("allows nested Tailscale Funnel hosts, not only one label under ts.net", () => {
    expect(TAILSCALE_MAGICDNS_PATTERN).toBe("**.ts.net");
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
      theme_color: "#1c1916",
    });
  });

  it("opens a phone URL with Funnel instead of requiring Tailscale on the phone", () => {
    expect(tailscaleFunnelArgs()).toEqual(["funnel", "--bg", "--yes", "3000"]);
  });

  it("reads Funnel HTTPS origins so Neon Auth can trust the phone address", () => {
    expect(funnelHttpsOrigins("https://office.tailnet.ts.net/\n|-- proxy http://127.0.0.1:3000\n")).toEqual([
      "https://office.tailnet.ts.net",
    ]);
    expect(funnelAuthDomainHint("https://office.tailnet.ts.net")).toContain("Neon Console");
  });
});

describe("local PC always-up", () => {
  it("pulls main only when the PC is on a clean main branch behind origin", () => {
    expect(decideLocalMainSync({ branch: "main", dirty: false, behindMain: true })).toMatchObject({ action: "pull" });
    expect(decideLocalMainSync({ branch: "main", dirty: false, behindMain: false }).action).toBe("skip");
    expect(decideLocalMainSync({ branch: "main", dirty: true, behindMain: true })).toMatchObject({ action: "skip" });
    expect(decideLocalMainSync({ branch: "cursor/local-always-up-0ce2", dirty: false, behindMain: true }).action).toBe("skip");
  });

  it("always prints the PC dashboard URL next to the phone Funnel address", () => {
    const banner = formatLocalUpBanner({ phoneOrigins: ["https://office.tailnet.ts.net"] });
    expect(banner).toContain(PC_DEV_DASHBOARD);
    expect(banner).toContain("https://office.tailnet.ts.net");
    expect(banner).toContain("PC에서는 Tailscale 없이");
  });
});
