// Funnel hosts are machine.tailnet.ts.net. Next.js `*.ts.net` matches only one label.
export const TAILSCALE_MAGICDNS_PATTERN = "**.ts.net";
export const LOCAL_MDNS_PATTERN = "*.local";

function ipv4Octets(address: string) {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return octets as [number, number, number, number];
}

export function isTailscaleIPv4(address: string) {
  const octets = ipv4Octets(address);
  if (!octets) return false;
  return octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}

export function isPrivateIPv4(address: string) {
  const octets = ipv4Octets(address);
  if (!octets) return false;
  const [first, second] = octets;
  if (first === 10 || first === 127) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return isTailscaleIPv4(address);
}

function originHost(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.includes("://")) return new URL(trimmed).host;
    return trimmed;
  } catch {
    return null;
  }
}

export function machineOriginHosts(machineName?: string) {
  const name = machineName?.trim().toLowerCase();
  if (!name) return [];
  if (!/^[a-z0-9-]+$/.test(name)) return [];
  return [name, `${name}.local`];
}

export function allowedDevelopmentOrigins(input: {
  addresses: string[];
  machineName?: string;
  extraOrigins?: string;
}) {
  const extras = (input.extraOrigins ?? "")
    .split(",")
    .map((item) => originHost(item))
    .filter((item): item is string => Boolean(item));
  return [...new Set([
    TAILSCALE_MAGICDNS_PATTERN,
    LOCAL_MDNS_PATTERN,
    ...machineOriginHosts(input.machineName),
    ...input.addresses.filter(isPrivateIPv4),
    ...extras,
  ])];
}

export function lanListenAddresses(addresses: string[]) {
  return [...new Set(addresses.filter((address) => isPrivateIPv4(address) && address !== "127.0.0.1"))];
}
