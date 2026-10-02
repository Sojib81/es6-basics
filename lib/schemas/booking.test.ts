import { describe, expect, it } from "vitest";
import { bookingRequestSchema, enquiryRequestSchema } from "./booking";

const booking = {
  estimate: { service: "vacate", bedrooms: 2, bathrooms: 1 },
  bookerRole: "tenant",
  preferredDate: "2026-10-08",
  timeWindow: "am",
  address: "1 Example St",
  suburb: "Belmont",
  name: "Jane",
  phone: "0412 345 678",
  email: "jane@example.com ",
  confirmCallUnderstood: true,
  turnstileToken: "t",
};

describe("public form schemas", () => {
  it("accepts emails with stray spaces from phone keyboards", () => {
    const r = bookingRequestSchema.safeParse(booking);
    expect(r.success).toBe(true);
    expect(r.data?.email).toBe("jane@example.com");
  });

  it("enquiry email is optional but validated when given", () => {
    const base = {
      type: "contact",
      name: "Jane",
      phone: "0412345678",
      message: "Hello there",
      turnstileToken: "t",
    };
    expect(enquiryRequestSchema.safeParse({ ...base, email: "" }).data?.email).toBeUndefined();
    expect(enquiryRequestSchema.safeParse({ ...base, email: " a@b.com " }).data?.email).toBe(
      "a@b.com",
    );
    expect(enquiryRequestSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
    expect(enquiryRequestSchema.safeParse(base).success).toBe(true);
  });

  it("requires a mobile for bookings but any AU number for enquiries", () => {
    expect(bookingRequestSchema.safeParse({ ...booking, phone: "(08) 9333 1234" }).success).toBe(
      false,
    );
    expect(
      enquiryRequestSchema.safeParse({
        type: "contact",
        name: "Jo",
        phone: "(08) 9333 1234",
        message: "Hello there",
        turnstileToken: "t",
      }).success,
    ).toBe(true);
  });
});
