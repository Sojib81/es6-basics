import { MobileCtaBar } from "@/components/site/mobile-cta-bar";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { TrackingScripts } from "@/components/site/tracking-scripts";
import { getBusinessInfo } from "@/lib/data/business";
import { getMediaById, mediaUrl } from "@/lib/data/content";
import { getSetting } from "@/lib/data/settings";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [business, tracking] = await Promise.all([getBusinessInfo(), getSetting("tracking")]);
  const logoMedia = await getMediaById(business.logoMediaId);
  const logo = logoMedia
    ? {
        src: mediaUrl(logoMedia),
        alt: logoMedia.alt,
        width: logoMedia.width ?? 160,
        height: logoMedia.height ?? 40,
      }
    : null;

  return (
    <>
      <SiteHeader business={business} logo={logo} />
      <main id="main" className="pb-mobile-bar flex-1 md:pb-0">
        {children}
      </main>
      <SiteFooter business={business} />
      <MobileCtaBar phone={business.phone} />
      <TrackingScripts {...tracking} />
    </>
  );
}
