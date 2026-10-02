"use client";
/**
 * Loads GA4 / Google Ads / Meta Pixel only when their IDs are set (admin → Settings → Tracking),
 * captures ad attribution, and tracks phone-link clicks (any element with data-track="click_call").
 * Rendered by the public site layout only — never on /admin or invoices.
 */
import Script from "next/script";
import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";
import { track } from "@/lib/tracking-client";

type Props = {
  ga4Id: string;
  googleAdsId: string;
  googleAdsLeadLabel: string;
  googleAdsDepositLabel: string;
  metaPixelId: string;
};

const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;

export function TrackingScripts(props: Props) {
  const ga4 = SAFE_ID.test(props.ga4Id) ? props.ga4Id : "";
  const ads = SAFE_ID.test(props.googleAdsId) ? props.googleAdsId : "";
  const pixel = /^\d{5,20}$/.test(props.metaPixelId) ? props.metaPixelId : "";
  const gtagId = ga4 || ads;

  useEffect(() => {
    captureAttribution();
    window.__tracking = {
      googleAdsId: ads || undefined,
      leadLabel: props.googleAdsLeadLabel || undefined,
      depositLabel: props.googleAdsDepositLabel || undefined,
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-track="click_call"]');
      if (el) track("click_call");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [ads, props.googleAdsLeadLabel, props.googleAdsDepositLabel]);

  return (
    <>
      {gtagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());` +
              (ga4 ? `gtag('config','${ga4}');` : "") +
              (ads ? `gtag('config','${ads}');` : "")}
          </Script>
        </>
      )}
      {pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
