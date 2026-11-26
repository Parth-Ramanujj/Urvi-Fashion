"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export default function MetaPixel({ pixelId }: { pixelId: string }) {
  const path = usePathname();
  const initial = useRef(true);
  useEffect(() => {
    if (initial.current) { initial.current = false; return; }
    if (path.startsWith("/admin")) return;
    window.fbq?.("track", "PageView");
  }, [path]);

  const code = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(pixelId)});fbq('track','PageView');`;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: code }} />
      <noscript><img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`} /></noscript>
    </>
  );
}
