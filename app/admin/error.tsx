"use client";
/** Admin error: give the owner the error ID so a developer can find it in the Worker logs. */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-6">
      <h1 className="text-ink text-lg font-bold">Something went wrong</h1>
      <p className="text-muted mt-2 text-sm">
        Your change may not have been saved. Try again; if it keeps happening, send this to your
        developer:
      </p>
      <p className="mt-2 font-mono text-xs">
        {error.digest ? `Error ID ${error.digest}` : error.message} · {new Date().toISOString()}
      </p>
      <button
        onClick={() => retry()}
        className="bg-brand mt-4 rounded-lg px-4 py-2 font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
