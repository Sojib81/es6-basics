import { MobileCtaBar } from "@/components/site/mobile-cta-bar";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getBusinessInfo } from "@/lib/data/business";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const business = await getBusinessInfo();

  return (
    <>
      <SiteHeader business={business} />
      <main id="main" className="pb-mobile-bar flex-1 md:pb-0">
        {children}
      </main>
      <SiteFooter business={business} />
      <MobileCtaBar phone={business.phone} />
    </>
  );
}
