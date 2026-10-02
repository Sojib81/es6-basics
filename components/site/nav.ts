// Site navigation structure (routes, not business data). Pages are built in Phases 3–4.
export const mainNav = [
  { href: "/services/vacate-cleaning", label: "Bond cleaning" },
  { href: "/pricing", label: "Prices" },
  { href: "/property-managers", label: "Property managers" },
  { href: "/areas", label: "Areas" },
  { href: "/contact", label: "Contact" },
] as const;

export const policyNav = [
  { href: "/policies/privacy", label: "Privacy" },
  { href: "/policies/terms", label: "Terms" },
  { href: "/policies/deposit-and-cancellation", label: "Deposit & cancellation" },
] as const;
