"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncPlanToStripe } from "@/lib/stripe-sync";
import { isSupportedCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { BILLING_CADENCES } from "@/lib/billing-cadences";

const schema = z.object({
  trialDays: z.coerce.number().int().min(0).max(90),
  active: z.boolean(),
  currency: z.string().refine(isSupportedCurrency, "Unsupported currency"),
});

function parseDollarsToCents(raw: FormDataEntryValue | null): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

export async function upsertPlanAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");

  const parsed = schema.parse({
    trialDays: formData.get("trialDays"),
    active: formData.get("active") === "on",
    currency: formData.get("currency") || DEFAULT_CURRENCY,
  });

  // Currency is account-level: persist on the creator (source of truth).
  await db.creator.update({
    where: { id: creator.id },
    data: { currency: parsed.currency },
  });

  const plan = await db.plan.upsert({
    where: { creatorId: creator.id },
    update: { trialDays: parsed.trialDays, active: parsed.active, currency: parsed.currency },
    create: {
      creatorId: creator.id,
      trialDays: parsed.trialDays,
      active: parsed.active,
      currency: parsed.currency,
    },
  });

  // Reconcile one PlanPrice per cadence from the form. A filled price upserts an
  // active row; a blank price deactivates an existing one (the Stripe sync then
  // archives its Price, grandfathering current subscribers).
  for (const cadence of BILLING_CADENCES) {
    const cents = parseDollarsToCents(formData.get(`price_${cadence.key}`));
    const existing = await db.planPrice.findUnique({
      where: {
        planId_interval_intervalCount: {
          planId: plan.id,
          interval: cadence.interval,
          intervalCount: cadence.intervalCount,
        },
      },
    });

    if (cents == null) {
      if (existing?.active) {
        await db.planPrice.update({ where: { id: existing.id }, data: { active: false } });
      }
    } else if (existing) {
      await db.planPrice.update({
        where: { id: existing.id },
        data: { priceCents: cents, active: true },
      });
    } else {
      await db.planPrice.create({
        data: {
          planId: plan.id,
          interval: cadence.interval,
          intervalCount: cadence.intervalCount,
          priceCents: cents,
          active: true,
        },
      });
    }
  }

  await db.course.updateMany({
    where: { creatorId: creator.id, currency: { not: parsed.currency } },
    data: { currency: parsed.currency },
  });

  // Sync Product + Prices to the connected account. Reconciles new/changed
  // cadences and archives deactivated ones. No-op until the creator is onboarded.
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
