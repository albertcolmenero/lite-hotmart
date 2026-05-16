"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaywallModal, type PaywallPlan } from "./paywall-modal";

export function StartButton({
  allowed,
  signedIn,
  href,
  label = "Start",
  className,
  creator,
  plan,
}: {
  allowed: boolean;
  signedIn: boolean;
  href?: string;
  label?: string;
  className?: string;
  creator: { id: string; displayName: string; accentColor: string };
  plan: PaywallPlan | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const onClick = () => {
    if (allowed) {
      if (href) router.push(href);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={className ?? "btn btn-primary btn-lg w-full"}
      >
        {label}
      </button>
      <PaywallModal
        open={open}
        onClose={() => setOpen(false)}
        creatorId={creator.id}
        creatorName={creator.displayName}
        creatorAccent={creator.accentColor}
        plan={plan}
        signedIn={signedIn}
      />
    </>
  );
}
