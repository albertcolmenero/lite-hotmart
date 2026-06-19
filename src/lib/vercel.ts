/**
 * Thin Vercel Domains API client.
 *
 * Docs: https://vercel.com/docs/rest-api/endpoints/projects#add-a-domain-to-a-project
 *
 * Required env:
 *   VERCEL_TOKEN       — personal/team token with "domains:write" scope
 *   VERCEL_PROJECT_ID  — the project that should serve the domain
 *   VERCEL_TEAM_ID     — optional, when the project is owned by a team
 *
 * Behavior:
 *   - When env is missing, every function throws so the caller can degrade
 *     gracefully (we surface a clear error in the studio UI).
 *   - In dev (NODE_ENV !== "production"), `IS_DEV_BYPASS_VERCEL` short-circuits
 *     to a fake "verified+configured" response so you can test the flow without
 *     a real Vercel project.
 */

const API = "https://api.vercel.com";

export const IS_DEV_BYPASS_VERCEL =
  process.env.NODE_ENV !== "production" && !process.env.VERCEL_TOKEN;

function requireEnv() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) {
    throw new Error(
      "VERCEL_TOKEN and VERCEL_PROJECT_ID must be set to manage custom domains.",
    );
  }
  const teamId = process.env.VERCEL_TEAM_ID;
  return { token, projectId, teamId };
}

function teamQuery(teamId: string | undefined) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

export type VercelDomain = {
  name: string;
  apexName: string;
  verified: boolean;
  verification?: { type: string; domain: string; value: string; reason: string }[];
};

export type VercelDomainConfig = {
  configured: boolean;
  misconfigured: boolean;
  // True when Vercel has confirmed the DNS records are correct AND ownership is proven.
  // We use this combined with `domain.verified` to flip our local status to "active".
};

export async function addDomainToProject(domain: string): Promise<VercelDomain> {
  if (IS_DEV_BYPASS_VERCEL) {
    return { name: domain, apexName: domain, verified: true };
  }
  const { token, projectId, teamId } = requireEnv();
  const res = await fetch(
    `${API}/v10/projects/${projectId}/domains${teamQuery(teamId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `Vercel: ${body?.error?.message ?? body?.error?.code ?? res.statusText} (status ${res.status})`,
    );
  }
  return (await res.json()) as VercelDomain;
}

export async function getDomain(domain: string): Promise<VercelDomain | null> {
  if (IS_DEV_BYPASS_VERCEL) {
    return { name: domain, apexName: domain, verified: true };
  }
  const { token, projectId, teamId } = requireEnv();
  const res = await fetch(
    `${API}/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${teamQuery(teamId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Vercel: ${res.statusText}`);
  return (await res.json()) as VercelDomain;
}

export async function getDomainConfig(domain: string): Promise<VercelDomainConfig> {
  if (IS_DEV_BYPASS_VERCEL) {
    return { configured: true, misconfigured: false };
  }
  const { token, teamId } = requireEnv();
  const res = await fetch(
    `${API}/v6/domains/${encodeURIComponent(domain)}/config${teamQuery(teamId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Vercel: ${res.statusText}`);
  const json = (await res.json()) as { misconfigured?: boolean };
  return {
    configured: !json.misconfigured,
    misconfigured: Boolean(json.misconfigured),
  };
}

/** Combined "is this domain ready to serve?" check. */
export async function verifyDomain(
  domain: string,
): Promise<{ ready: boolean; vercel: VercelDomain | null; config: VercelDomainConfig }> {
  const [vercel, config] = await Promise.all([
    getDomain(domain).catch(() => null),
    getDomainConfig(domain),
  ]);
  const ready = Boolean(vercel?.verified) && config.configured;
  return { ready, vercel, config };
}

export async function removeDomainFromProject(domain: string): Promise<void> {
  if (IS_DEV_BYPASS_VERCEL) return;
  const { token, projectId, teamId } = requireEnv();
  const res = await fetch(
    `${API}/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${teamQuery(teamId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Vercel: ${res.statusText}`);
  }
}

/**
 * The DNS record creators need to add. For a subdomain like
 * `studio.example.com`, this is a CNAME to `cname.vercel-dns.com`.
 * Apex domains (V5) need an A record; we don't support apex here.
 */
export function dnsInstructionsFor(domain: string): {
  type: "CNAME" | "A";
  host: string;
  value: string;
} {
  const parts = domain.split(".");
  // Heuristic: 2 parts = apex; 3+ parts = subdomain.
  if (parts.length === 2) {
    return { type: "A", host: "@", value: "76.76.21.21" };
  }
  // The DNS host is everything left of the apex (last two labels): for
  // "studio.example.com" → "studio"; for "studio.www.example.com" → "studio.www".
  return {
    type: "CNAME",
    host: parts.slice(0, -2).join("."),
    value: "cname.vercel-dns.com",
  };
}
