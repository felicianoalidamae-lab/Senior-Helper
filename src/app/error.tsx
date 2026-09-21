"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card max-w-sm text-center">
        <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
        <p className="mt-2 text-muted">Check your connection and try again.</p>
        <button type="button" onClick={() => reset()} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    </div>
  );
}
