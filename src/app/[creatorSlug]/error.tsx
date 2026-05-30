"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/observability";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "storefront", digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-h1">This page is having trouble</h1>
        <p className="mt-2" style={{ color: "var(--lichen)" }}>
          We couldn&apos;t load this part of the storefront. Please try again in a
          moment.
        </p>
        <div className="mt-6">
          <button onClick={reset} className="btn btn-primary">
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
