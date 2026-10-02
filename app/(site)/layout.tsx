import { MobileCtaBar } from "@/components/site/mobile-cta-bar";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { TrackingScripts } from "@/components/site/tracking-scripts";
import { getBusinessInfo } from "@/lib/data/business";
import { getSetting } from "@/lib/data/settings";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [business, tracking] = await Promise.all([getBusinessInfo(), getSetting("tracking")]);

  return (
    <>
      <SiteHeader business={business} />
      <main id="main" className="pb-mobile-bar flex-1 md:pb-0">
        {children}
      </main>
      <SiteFooter business={business} />
      <MobileCtaBar phone={business.phone} />
      <TrackingScripts {...tracking} />
    </>
  );
}
