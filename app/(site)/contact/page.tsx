import type { Metadata } from "next";
import { EnquiryForm } from "@/components/site/enquiry-form";
import { Section } from "@/components/site/section";
import { getBusinessInfo } from "@/lib/data/business";
import { getActiveServices, getSuburbs } from "@/lib/data/content";
import { pageMetadata } from "@/lib/data/site";
import { formatAuPhone } from "@/lib/phone";
import { WEEKDAYS } from "@/lib/time";

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({ title: "Contact us", path: "/contact" });
}

const DAY_NAMES: Record<(typeof WEEKDAYS)[number], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
};

export default async function ContactPage() {
  const [business, services] = await Promise.all([getBusinessInfo(), getActiveServices()]);
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  return (
    <Section>
      <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h1 className="text-ink text-3xl font-extrabold tracking-tight">Contact us</h1>
          <p className="text-muted mt-3">{business.responsePromise}.</p>
          <dl className="mt-6 space-y-3">
            <div>
              <dt className="text-muted text-sm">Phone</dt>
              <dd>
                <a
                  href={`tel:${business.phone}`}
                  className="text-brand text-lg font-semibold"
                  data-track="click_call"
                >
                  {formatAuPhone(business.phone)}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted text-sm">Email</dt>
              <dd>
                <a href={`mailto:${business.publicEmail}`} className="text-brand font-semibold">
                  {business.publicEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted text-sm">Hours</dt>
              <dd>
                <ul className="text-sm">
                  {order.map((d) => {
                    const h = business.businessHours[d];
                    return (
                      <li key={d} className="flex justify-between gap-4">
                        <span>{DAY_NAMES[d]}</span>
                        <span>{h ? `${to12h(h.open)} – ${to12h(h.close)}` : "Closed"}</span>
                      </li>
                    );
                  })}
                </ul>
              </dd>
            </div>
          </dl>
        </div>
        <div>
          <h2 className="text-ink mb-4 text-xl font-bold">Send us a message</h2>
          <EnquiryForm
            defaultType="contact"
            services={services.map((s) => ({ slug: s.slug, title: s.title }))}
            suburbs={getSuburbs().map((s) => s.name)}
          />
        </div>
      </div>
    </Section>
  );
}
