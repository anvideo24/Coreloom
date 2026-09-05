"use client";

import { useEffect } from "react";

/** HTTPS(Funnel 포함)면 개발 서버에서도 등록한다. HTTP localhost는 브라우저가 막아 건너뛴다. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Funnel·로컬에서 등록 실패해도 화면은 그대로 둔다 */
    });
  }, []);
  return null;
}
