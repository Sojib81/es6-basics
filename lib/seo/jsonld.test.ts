import { describe, expect, it } from "vitest";
import seed from "@/seed/settings.json";
import { businessSchema } from "@/lib/schemas/settings";
import { breadcrumbLd, faqLd, localBusinessLd, serializeLd, serviceLd } from "./jsonld";

const business = businessSchema.parse(seed.business);

describe("JSON-LD", () => {
  it("LocalBusiness is a service-area business with no street address", () => {
    const ld = localBusinessLd({
      business,
      siteUrl: "https://x.au",
      suburbs: [{ name: "Belmont" }],
    });
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld).not.toHaveProperty("address");
    expect(ld.areaServed).toEqual([{ "@type": "Place", name: "Belmont WA" }]);
    expect((ld.openingHoursSpecification as unknown[]).length).toBe(6); // Sunday closed
    expect(ld).not.toHaveProperty("sameAs"); // no empty socials
  });

  it("Service offers a minimum price in AUD", () => {
    const ld = serviceLd({
      name: "Vacate",
      description: "d",
      url: "u",
      siteUrl: "s",
      suburbs: [],
      priceFromCents: 26000,
    });
    expect(ld.offers).toMatchObject({
      priceSpecification: { minPrice: "260.00", priceCurrency: "AUD" },
    });
    expect(
      serviceLd({
        name: "Office",
        description: "d",
        url: "u",
        siteUrl: "s",
        suburbs: [],
        priceFromCents: null,
      }),
    ).not.toHaveProperty("offers");
  });

  it("FAQ and breadcrumbs", () => {
    expect(faqLd([])).toBeNull();
    expect(faqLd([{ question: "Q?", answer: "A" }])!.mainEntity).toHaveLength(1);
    expect(breadcrumbLd("https://x.au", [{ name: "Home", path: "/" }]).itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://x.au/" },
    ]);
  });

  it("serialisation can't break out of the script tag", () => {
    expect(serializeLd({ a: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
