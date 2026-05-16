/** Shared secret for middleware → Node route custom-domain resolution. */
export function getDomainLookupSecret(): string {
  return (
    process.env.MIDDLEWARE_DOMAIN_LOOKUP_SECRET ??
    (process.env.NODE_ENV === "development" ? "__dev_domain_lookup__" : "")
  );
}
