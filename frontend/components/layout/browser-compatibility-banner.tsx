"use client";

import { useEffect, useState } from "react";

function unsupportedBrowser(userAgent: string): boolean {
  const edge = userAgent.match(/Edg\/(\d+)/); if (edge) return Number(edge[1]) < 109;
  const chrome = userAgent.match(/(?:Chrome|Chromium)\/(\d+)/); if (chrome) return Number(chrome[1]) < 109;
  const firefox = userAgent.match(/Firefox\/(\d+)/); if (firefox) return Number(firefox[1]) < 115;
  const safari = userAgent.match(/Version\/(\d+).*Safari/); if (safari) return Number(safari[1]) < 16;
  return false;
}

export function BrowserCompatibilityBanner() {
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => setUnsupported(unsupportedBrowser(navigator.userAgent)), []);
  if (!unsupported) return null;
  return <div role="alert" className="browser-compatibility-banner">当前浏览器版本过旧。请升级到 Chrome/Edge 109、Firefox 115 或 Safari 16 以上版本。</div>;
}
