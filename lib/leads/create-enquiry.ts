/** Creates an enquiry (contact / quote / property manager) from a validated form. */
import { auditInsert } from "@/lib/audit";
import { matchOrCreateCustomer } from "@/lib/customers";
import type { Db } from "@/lib/db/client";
import { newId, nowIso } from "@/lib/db/ids";
import { enquiries } from "@/lib/db/schema";
import { withUniqueRef } from "@/lib/refs";
import type { EnquiryRequest } from "@/lib/schemas/booking";

export async function createEnquiry(
  db: Db,
  req: EnquiryRequest,
  now: Date = new Date(),
): Promise<{ enquiryId: string; ref: string }> {
  const match = await matchOrCreateCustomer(db, {
    phone: req.phone,
    name: req.name,
    email: req.email,
    type: req.type === "property_manager" ? "property_manager" : "individual",
    agency: req.agency,
  });
  const enquiryId = newId();
  const ts = nowIso(now);
  const ref = await withUniqueRef("EQ", async (ref) => {
    await db.batch([
      db.insert(enquiries).values({
        id: enquiryId,
        ref,
        customerId: match.customerId,
        customerDetailsDiffer: match.detailsDiffer,
        type: req.type,
        submittedName: req.name,
        email: req.email?.toLowerCase() ?? null,
        phone: req.phone,
        subject: null,
        message: req.message,
        serviceInterest: req.serviceInterest ?? null,
        suburb: req.suburb ?? null,
        agency: req.agency ?? null,
        utmSource: req.attribution.utmSource ?? null,
        utmMedium: req.attribution.utmMedium ?? null,
        utmCampaign: req.attribution.utmCampaign ?? null,
        gclid: req.attribution.gclid ?? null,
        fbclid: req.attribution.fbclid ?? null,
        createdAt: ts,
        updatedAt: ts,
      }),
      auditInsert(db, {
        actorEmail: "public",
        action: "create",
        entity: "enquiry",
        entityId: enquiryId,
        after: { ref, type: req.type },
      }),
    ]);
    return ref;
  });
  return { enquiryId, ref };
}
