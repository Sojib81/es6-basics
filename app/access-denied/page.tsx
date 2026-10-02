import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

export default function AccessDenied() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 text-center">
      <h1 className="text-ink text-2xl font-bold">Access denied</h1>
      <p className="text-muted mt-3">
        Your email isn&apos;t set up as an admin. Ask the owner to add you in Admin → Settings →
        Users, and in the Cloudflare Access policy.
      </p>
    </main>
  );
}
