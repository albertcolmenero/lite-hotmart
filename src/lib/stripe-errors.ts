import { NextResponse } from "next/server";
import { captureException } from "@/lib/observability";

/**
 * Turn a thrown Stripe (or other) error into a logged, diagnosable JSON 500
 * instead of an opaque Next error page. These Connect routes are reached by an
 * authenticated creator, so returning the Stripe message/code/requestId is safe
 * (it's not a credential) and makes prod failures debuggable without digging
 * through logs. No env values are ever included.
 */
export function stripeRouteError(
  err: unknown,
  route: string,
  context: Record<string, unknown> = {},
): NextResponse {
  captureException(err, { route, ...context });
  const e = err as {
    message?: string;
    type?: string;
    code?: string;
    requestId?: string;
  };
  return NextResponse.json(
    {
      error: "stripe_request_failed",
      route,
      message: e?.message ?? String(err),
      type: e?.type ?? null,
      code: e?.code ?? null,
      requestId: e?.requestId ?? null,
      hint:
        "Check Stripe Dashboard → Developers → Logs (live mode) and Vercel logs. " +
        "Common causes: Connect not enabled on the platform account; missing/placeholder " +
        "STRIPE_SECRET_KEY; NEXT_PUBLIC_APP_URL not set to your https origin; or a test-mode " +
        "account id used with a live key.",
    },
    { status: 500 },
  );
}
