/** localStorage: 설치 안내를 닫은 시각(ms). */
export const PWA_INSTALL_DISMISSED_KEY = "coreloom.pwa-install-dismissed";

/** 닫은 뒤 다시 보이기까지(7일). */
export const PWA_INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export type PwaInstallKind = "native" | "ios-guide" | "hidden";

export function isStandaloneDisplay(input: {
  displayModeStandalone: boolean;
  iosStandalone: boolean;
}) {
  return input.displayModeStandalone || input.iosStandalone;
}

export function isIosSafariUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const isAppleMobile = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && /mobile/.test(ua));
  const isCriOS = /crios/.test(ua);
  const isFxiOS = /fxios/.test(ua);
  return isAppleMobile && !isCriOS && !isFxiOS;
}

export function shouldOfferPwaInstall(input: {
  secureContext: boolean;
  standalone: boolean;
  narrowViewport: boolean;
  dismissedAt: number | null;
  now: number;
  canNativeInstall: boolean;
  iosSafari: boolean;
}): PwaInstallKind {
  if (!input.secureContext || input.standalone || !input.narrowViewport) return "hidden";
  if (input.dismissedAt !== null && input.now - input.dismissedAt < PWA_INSTALL_DISMISS_MS) {
    return "hidden";
  }
  if (input.canNativeInstall) return "native";
  if (input.iosSafari) return "ios-guide";
  return "hidden";
}

export function parsePwaInstallDismissedAt(raw: string | null) {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
