import { getCreatorForCurrentUser } from "@/lib/auth";
import { StripeStatusCard } from "@/components/stripe-status";

export default async function SettingsPage() {
  const creator = (await getCreatorForCurrentUser())!;
  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Settings</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Account-level details.
        </p>
      </header>

      <div className="card overflow-hidden">
        <Row k="Public URL" v={`/${creator.slug}`} />
        <Row
          k="Custom domain"
          v={
            creator.customDomain
              ? `${creator.customDomain} · ${creator.customDomainStatus ?? "unknown"}`
              : "Not set"
          }
        />
        <Row k="Created" v={creator.createdAt.toLocaleDateString()} />
      </div>

      <StripeStatusCard creator={creator} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div
      className="px-5 py-4 flex justify-between items-baseline text-sm"
      style={{ borderBottom: "1px solid var(--bone)" }}
    >
      <span style={{ color: "var(--lichen)" }}>{k}</span>
      <span className="tabular" style={{ color: "var(--ink)" }}>{v}</span>
    </div>
  );
}
