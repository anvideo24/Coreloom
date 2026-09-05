"use client";

import { useEffect, useState } from "react";

import {
  isIosSafariUserAgent,
  isStandaloneDisplay,
  parsePwaInstallDismissedAt,
  PWA_INSTALL_DISMISSED_KEY,
  shouldOfferPwaInstall,
  type PwaInstallKind,
} from "@/lib/pwa/install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readNarrowViewport() {
  return window.matchMedia("(max-width: 39.98rem)").matches;
}

function readStandalone() {
  return isStandaloneDisplay({
    displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
    iosStandalone: "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  });
}

export function PwaInstallPrompt() {
  const [kind, setKind] = useState<PwaInstallKind>("hidden");
  const [guideOpen, setGuideOpen] = useState(false);
  const [nativeEvent, setNativeEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function refresh(nextNative: BeforeInstallPromptEvent | null = nativeEvent) {
      setKind(
        shouldOfferPwaInstall({
          secureContext: window.isSecureContext,
          standalone: readStandalone(),
          narrowViewport: readNarrowViewport(),
          dismissedAt: parsePwaInstallDismissedAt(window.localStorage.getItem(PWA_INSTALL_DISMISSED_KEY)),
          now: Date.now(),
          canNativeInstall: Boolean(nextNative),
          iosSafari: isIosSafariUserAgent(window.navigator.userAgent),
        }),
      );
    }

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setNativeEvent(promptEvent);
      refresh(promptEvent);
    }

    function onInstalled() {
      setNativeEvent(null);
      setKind("hidden");
      setGuideOpen(false);
    }

    const narrow = window.matchMedia("(max-width: 39.98rem)");
    const standalone = window.matchMedia("(display-mode: standalone)");
    const onViewport = () => refresh();
    narrow.addEventListener("change", onViewport);
    standalone.addEventListener("change", onViewport);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    refresh();
    return () => {
      narrow.removeEventListener("change", onViewport);
      standalone.removeEventListener("change", onViewport);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
    // nativeEvent는 refresh 인자로만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    window.localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, String(Date.now()));
    setKind("hidden");
    setGuideOpen(false);
  }

  async function installNative() {
    if (!nativeEvent) return;
    await nativeEvent.prompt();
    const choice = await nativeEvent.userChoice;
    setNativeEvent(null);
    if (choice.outcome === "accepted") {
      setKind("hidden");
      return;
    }
    setKind(
      shouldOfferPwaInstall({
        secureContext: window.isSecureContext,
        standalone: readStandalone(),
        narrowViewport: readNarrowViewport(),
        dismissedAt: parsePwaInstallDismissedAt(window.localStorage.getItem(PWA_INSTALL_DISMISSED_KEY)),
        now: Date.now(),
        canNativeInstall: false,
        iosSafari: isIosSafariUserAgent(window.navigator.userAgent),
      }),
    );
  }

  if (kind === "hidden") return null;

  return (
    <div className="pwa-install-layer">
      <div className="pwa-install-chip" role="region" aria-label="홈 화면에 앱 추가">
        <div className="pwa-install-copy">
          <strong>웹앱으로 설치</strong>
          <span>홈 화면에 두면 단독 앱처럼 엽니다.</span>
        </div>
        <div className="pwa-install-actions">
          {kind === "native" ? (
            <button className="pwa-install-primary" onClick={() => void installNative()} type="button">
              설치
            </button>
          ) : (
            <button className="pwa-install-primary" onClick={() => setGuideOpen(true)} type="button">
              방법
            </button>
          )}
          <button aria-label="설치 안내 닫기" className="pwa-install-dismiss" onClick={dismiss} type="button">
            ×
          </button>
        </div>
      </div>

      {guideOpen ? (
        <div className="pwa-install-guide" role="dialog" aria-label="홈 화면에 추가하는 방법">
          <button aria-label="안내 닫기" className="pwa-install-guide-backdrop" onClick={() => setGuideOpen(false)} type="button" />
          <div className="pwa-install-guide-card">
            <p className="setup-code">Safari</p>
            <h2>홈 화면에 추가</h2>
            <ol>
              <li>하단 공유 버튼(□↑)을 누릅니다.</li>
              <li>「홈 화면에 추가」를 고릅니다.</li>
              <li>추가를 누르면 Coreloom 아이콘이 생깁니다.</li>
            </ol>
            <button className="auth-submit" onClick={() => setGuideOpen(false)} type="button">
              확인
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
