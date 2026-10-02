"use client";
/** Public-site error: the header/footer (with the phone number) still render around this. */
export default function SiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-ink text-2xl font-bold">Sorry — something went wrong</h1>
      <p className="text-muted mt-3">
        Please try again. If you were in the middle of a booking, call us using the number at the
        top of the page — we&apos;re happy to take it over the phone.
      </p>
      <button
        onClick={() => retry()}
        className="bg-accent mt-6 rounded-lg px-6 py-3 font-semibold text-white"
      >
        Try again
      </button>
      {error.digest && <p className="text-muted mt-6 text-xs">Error ID: {error.digest}</p>}
    </section>
  );
}
