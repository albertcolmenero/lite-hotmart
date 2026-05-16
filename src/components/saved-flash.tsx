"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

/**
 * Detects ?saved=… in the URL and fires a sonner toast, then strips the param.
 * Drop into any studio page that wants to celebrate a save.
 */
export function SavedFlash() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const flag = params.get("saved");
    if (!flag) return;
    const map: Record<string, { title: string; description?: string }> = {
      plan: { title: "Plan saved", description: "Visitors see the new prices immediately." },
      class: { title: "Class saved", description: "Live on your storefront." },
      series: { title: "Series saved" },
      course: { title: "Course saved" },
      branding: { title: "Branding saved" },
      tag: { title: "Tag added" },
      deleted: { title: "Deleted" },
      published: { title: "Profile published", description: "You're live." },
      unpublished: { title: "Profile unpublished", description: "Your storefront is hidden." },
      stripe: { title: "Stripe connected", description: "Payouts will land in your bank." },
      "stripe-pending": {
        title: "Stripe needs a bit more info",
        description: "Continue onboarding to start taking payments.",
      },
      "domain-added": {
        title: "Domain added",
        description: "Add the DNS record shown below, then click Verify.",
      },
      "domain-checked": {
        title: "Still verifying",
        description: "DNS isn't quite right yet. Double-check the record and try again.",
      },
      "domain-active": {
        title: "Domain is live",
        description: "Your storefront is now served at your custom URL.",
      },
      "domain-removed": { title: "Domain removed" },
    };
    const t = map[flag] ?? { title: "Saved" };
    toast(t.title, { description: t.description });

    // strip query param
    const next = new URLSearchParams(params);
    next.delete("saved");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, router, pathname]);

  return null;
}
