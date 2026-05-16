import { ExternalLink, Globe } from "lucide-react";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { FormCard, Field } from "@/components/studio-form";
import { dnsInstructionsFor, IS_DEV_BYPASS_VERCEL } from "@/lib/vercel";
import {
  addCustomDomainAction,
  verifyCustomDomainAction,
  removeCustomDomainAction,
} from "./actions";

export default async function DomainPage() {
  const creator = (await getCreatorForCurrentUser())!;
  const status = creator.customDomainStatus;
  const domain = creator.customDomain;
  const dns = domain ? dnsInstructionsFor(domain) : null;

  return (
    <div className="max-w-2xl space-y-7">
      <header>
        <h1 className="text-h1">Custom domain</h1>
        <p className="mt-1.5" style={{ color: "var(--lichen)" }}>
          Host your storefront under your own subdomain — like{" "}
          <span className="font-mono">studio.yourdomain.com</span>.
          You keep the URL; we handle hosting and SSL.
        </p>
        {IS_DEV_BYPASS_VERCEL ? (
          <div
            className="mt-4 text-sm p-3 rounded-md"
            style={{
              background: "color-mix(in srgb, var(--amber) 10%, var(--paper))",
              border: "1px solid color-mix(in srgb, var(--amber) 30%, var(--bone))",
              color: "var(--ink)",
            }}
          >
            Dev mode — Vercel API isn&apos;t configured. Saved domains are marked
            <em> active </em> immediately so you can test the rewrite flow locally.
          </div>
        ) : null}
      </header>

      {!domain ? (
        <FormCard title="Connect a domain" description="Use a subdomain you own. Apex domains coming later.">
          <form action={addCustomDomainAction} className="space-y-4">
            <Field label="Domain">
              <input
                name="domain"
                required
                placeholder="studio.yourdomain.com"
                className="input input-mono"
                pattern="^[a-z0-9.-]+\.[a-z]{2,}$"
              />
            </Field>
            <button type="submit" className="btn btn-primary">
              <Globe size={14} strokeWidth={2} />
              Add domain
            </button>
          </form>
        </FormCard>
      ) : null}

      {domain && (status === "pending_verification" || status === "pending_dns" || status === "error") ? (
        <FormCard title={`Set up DNS for ${domain}`} description="Add this record at your DNS provider. Verification usually takes a minute.">
          <div
            className="card p-4 space-y-3"
            style={{ background: "var(--surface)" }}
          >
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Kv label="Type" value={dns!.type} />
              <Kv label="Name / Host" value={dns!.host} />
              <Kv label="Value" value={dns!.value} mono />
            </div>
          </div>

          <div className="text-sm" style={{ color: "var(--lichen)" }}>
            Status:{" "}
            <StatusPill status={status} />
          </div>

          <div className="flex items-center gap-3">
            <form action={verifyCustomDomainAction}>
              <button type="submit" className="btn btn-primary">
                Check DNS &amp; verify
              </button>
            </form>
            <form action={removeCustomDomainAction}>
              <button
                type="submit"
                className="btn btn-ghost text-sm"
                style={{ color: "var(--rust)" }}
              >
                Remove domain
              </button>
            </form>
          </div>
        </FormCard>
      ) : null}

      {domain && (status === "verified" || status === "active") ? (
        <FormCard
          title="Domain is live"
          description="Your storefront serves at the URL below. SSL is auto-renewed."
        >
          <div className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusPill status={status} />
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                style={{ color: "var(--ink)" }}
              >
                {domain}
                <ExternalLink size={14} strokeWidth={2} />
              </a>
            </div>
            {creator.customDomainVerifiedAt ? (
              <div className="text-mono-sm" style={{ color: "var(--lichen)" }}>
                Verified {creator.customDomainVerifiedAt.toLocaleDateString()}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <form action={verifyCustomDomainAction}>
              <button type="submit" className="btn btn-secondary">
                Re-check
              </button>
            </form>
            <form action={removeCustomDomainAction}>
              <button
                type="submit"
                className="btn btn-ghost text-sm"
                style={{ color: "var(--rust)" }}
              >
                Disconnect domain
              </button>
            </form>
          </div>
        </FormCard>
      ) : null}
    </div>
  );
}

function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium" style={{ color: "var(--lichen)" }}>
        {label}
      </div>
      <div
        className={`mt-1 ${mono ? "font-mono" : ""} text-sm`}
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    pending_dns: { label: "Waiting for DNS", color: "var(--amber)" },
    pending_verification: { label: "Verifying", color: "var(--amber)" },
    verified: { label: "Verified · SSL issuing", color: "var(--accent)" },
    active: { label: "Active", color: "var(--moss)" },
    error: { label: "Error", color: "var(--rust)" },
  };
  const m = map[status ?? ""] ?? { label: "Unknown", color: "var(--lichen)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium"
      style={{ color: m.color }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: "currentColor" }}
      />
      {m.label}
    </span>
  );
}
