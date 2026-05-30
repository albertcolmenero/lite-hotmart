"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncPlanToStripe } from "@/lib/stripe-sync";
import { isSupportedCurrency, DEFAULT_CURRENCY } from "@/lib/currency";

const schema = z.object({
  monthlyDollars: z.string().optional().transform((v) => (v ? Number(v) : null)),
  yearlyDollars: z.string().optional().transform((v) => (v ? Number(v) : null)),
  trialDays: z.coerce.number().int().min(0).max(90),
  active: z.boolean(),
  currency: z.string().refine(isSupportedCurrency, "Unsupported currency"),
});

export async function upsertPlanAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const parsed = schema.parse({
    monthlyDollars: formData.get("monthlyDollars") || "",
    yearlyDollars: formData.get("yearlyDollars") || "",
    trialDays: formData.get("trialDays"),
    active: formData.get("active") === "on",
    currency: formData.get("currency") || DEFAULT_CURRENCY,
  });

  const monthlyCents =
    parsed.monthlyDollars != null && Number.isFinite(parsed.monthlyDollars)
      ? Math.round(parsed.monthlyDollars * 100)
      : null;
  const yearlyCents =
    parsed.yearlyDollars != null && Number.isFinite(parsed.yearlyDollars)
      ? Math.round(parsed.yearlyDollars * 100)
      : null;

  // Currency is account-level: persist on the creator (source of truth) and
  // stamp it onto the plan + every course so all prices read/charge in one
  // currency. Course Stripe prices re-mint to the new currency on their next
  // save or purchase (syncCourseToStripe detects the currency change).
  await db.creator.update({
    where: { id: creator.id },
    data: { currency: parsed.currency },
  });

  const plan = await db.plan.upsert({
    where: { creatorId: creator.id },
    update: {
      monthlyPriceCents: monthlyCents,
      yearlyPriceCents: yearlyCents,
      trialDays: parsed.trialDays,
      active: parsed.active,
      currency: parsed.currency,
    },
    create: {
      creatorId: creator.id,
      monthlyPriceCents: monthlyCents,
      yearlyPriceCents: yearlyCents,
      trialDays: parsed.trialDays,
      active: parsed.active,
      currency: parsed.currency,
    },
  });

  await db.course.updateMany({
    where: { creatorId: creator.id, currency: { not: parsed.currency } },
    data: { currency: parsed.currency },
  });

  // If the creator is Stripe-onboarded, sync Product + Prices on their account.
  // A currency change archives the old Prices and creates new ones (existing
  // subscribers stay grandfathered on the old-currency Price). Best-effort: if
  // Stripe rejects (network blip, archived account), the save still succeeds.
  try {
    await syncPlanToStripe(creator, plan);
  } catch (err) {
    console.error("[plan-sync] syncPlanToStripe failed", err);
  }

  revalidatePath("/studio/plan");
  revalidatePath("/studio/courses");
  revalidatePath(`/${creator.slug}`);
  revalidatePath(`/${creator.slug}/courses`);
  redirect("/studio/plan?saved=plan");
}
