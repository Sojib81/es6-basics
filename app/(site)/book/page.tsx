import type { Metadata } from "next";
import { BookingWizard } from "@/components/site/booking-wizard";
import { Section } from "@/components/site/section";
import { addDays, earliestBookableDate, MAX_DAYS_AHEAD } from "@/lib/booking-dates";
import { fullSlots, getSlotLoads } from "@/lib/capacity";
import { getBusinessInfo } from "@/lib/data/business";
import { getSuburbs } from "@/lib/data/content";
import { getSetting } from "@/lib/data/settings";
import { getServiceOptions, pageMetadata } from "@/lib/data/site";
import { getDb } from "@/lib/db/client";
import { decodeEstimate } from "@/lib/estimate-params";
import { perthDateString } from "@/lib/time";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: "Request a booking", path: "/book", noindex: true });
}

export default async function BookPage(props: PageProps<"/book">) {
  const now = new Date();
  const [business, pricing, booking, options, sp, db] = await Promise.all([
    getBusinessInfo(),
    getSetting("pricing"),
    getSetting("booking"),
    getServiceOptions(),
    props.searchParams,
    getDb(),
  ]);
  const earliestDate = earliestBookableDate(now, booking);
  const latestDate = addDays(perthDateString(now), MAX_DAYS_AHEAD);
  const loads = await getSlotLoads(db, earliestDate, latestDate);

  return (
    <Section>
      <h1 className="sr-only">Request a booking</h1>
      <BookingWizard
        pricing={pricing}
        services={options.filter((o) => o.key !== "office")}
        gstRegistered={business.gstRegistered}
        timeWindows={booking.timeWindows}
        depositEnabled={booking.depositEnabled}
        depositAmountCents={booking.depositAmountCents}
        confirmCheckboxText={booking.confirmCheckboxText}
        earliestDate={earliestDate}
        latestDate={latestDate}
        blockedDates={booking.blockedDates}
        fullSlots={fullSlots(loads, booking.maxJobsPerWindow)}
        suburbs={getSuburbs().map((s) => s.name)}
        initialEstimate={decodeEstimate(sp)}
      />
    </Section>
  );
}
