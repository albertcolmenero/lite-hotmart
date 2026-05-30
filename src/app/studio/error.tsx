"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@/lib/observability";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "studio", digest: error.digest });
  }, [error]);

  // Renders inside the studio layout's padded <main>, so no extra padding here.
  return (
    <div className="max-w-md">
      <h1 className="text-h1">Something broke in the studio</h1>
      <p className="mt-2" style={{ color: "var(--lichen)" }}>
        That action hit an unexpected error. Try again, or return to your
        dashboard.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/studio" className="btn btn-secondary">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
