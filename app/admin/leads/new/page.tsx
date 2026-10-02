import Link from "next/link";
import { ManualBookingForm } from "@/components/admin/manual-booking-form";
import { requireAdmin } from "@/lib/auth/admin";
import { getSuburbs } from "@/lib/data/content";
import { getSetting } from "@/lib/data/settings";
import { getServiceOptions } from "@/lib/data/site";
import { getDb } from "@/lib/db/client";
import { getEnquiryByRef } from "@/lib/leads/admin-ops";
import { formatAuPhone } from "@/lib/phone";
import { isRef } from "@/lib/refs";
import { perthDateString } from "@/lib/time";

export default async function NewBookingPage(props: PageProps<"/admin/leads/new">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const [pricing, booking, options] = await Promise.all([
    getSetting("pricing"),
    getSetting("booking"),
    getServiceOptions(),
  ]);
  const enquiryRef = typeof sp.enquiry === "string" && isRef(sp.enquiry, "EQ") ? sp.enquiry : null;
  const enquiry = enquiryRef ? await getEnquiryByRef(await getDb(), enquiryRef) : null;
  const prefill = enquiry
    ? {
        name: enquiry.enquiry.submittedName,
        phone: formatAuPhone(enquiry.enquiry.phone),
        email: enquiry.enquiry.email ?? "",
        suburb: enquiry.enquiry.suburb ?? "",
        notes: enquiry.enquiry.message,
        enquiryRef: enquiry.enquiry.ref,
      }
    : {};
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/leads" className="text-brand text-sm">
        ← Leads
      </Link>
      <h1 className="text-ink mt-1 mb-4 text-xl font-bold">New booking (phone)</h1>
      <ManualBookingForm
        pricing={pricing}
        services={options.filter((o) => o.key !== "office")}
        timeWindows={booking.timeWindows}
        suburbs={getSuburbs().map((s) => s.name)}
        today={perthDateString(new Date())}
        prefill={prefill}
      />
    </div>
  );
}
