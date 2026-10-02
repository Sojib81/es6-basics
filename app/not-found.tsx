import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-brand text-sm font-semibold tracking-wide uppercase">Page not found</p>
      <h1 className="text-ink mt-2 text-3xl font-extrabold">We couldn&apos;t find that page</h1>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="border-brand text-brand rounded-lg border-2 px-5 py-2 font-semibold"
        >
          Home
        </Link>
        <Link href="/pricing" className="bg-accent rounded-lg px-5 py-2 font-semibold text-white">
          Get a price
        </Link>
      </div>
    </main>
  );
}
