import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { StripeStatusCard } from "@/components/stripe-status";

export default async function SettingsPage() {
  const creator = (await getCreatorForCurrentUser())!;
  // Owner's email — when a super-admin is viewing as another creator, this is
  // the owning user's email, not the viewer's.
  const owner = await db.user.findUnique({
    where: { id: creator.userId },
    select: { email: true },
  });

  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Settings</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Account-level details.
        </p>
      </header>

      <div className="card overflow-hidden">
        <Row k="Owner" v={owner?.email ?? "—"} />
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
