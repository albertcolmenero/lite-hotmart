"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncPlanToStripe } from "@/lib/stripe-sync";

const schema = z.object({
  monthlyDollars: z.string().optional().transform((v) => (v ? Number(v) : null)),
  yearlyDollars: z.string().optional().transform((v) => (v ? Number(v) : null)),
  trialDays: z.coerce.number().int().min(0).max(90),
  active: z.boolean(),
});

export async function upsertPlanAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const parsed = schema.parse({
    monthlyDollars: formData.get("monthlyDollars") || "",
    yearlyDollars: formData.get("yearlyDollars") || "",
    trialDays: formData.get("trialDays"),
    active: formData.get("active") === "on",
  });

  const monthlyCents =
    parsed.monthlyDollars != null && Number.isFinite(parsed.monthlyDollars)
      ? Math.round(parsed.monthlyDollars * 100)
      : null;
  const yearlyCents =
    parsed.yearlyDollars != null && Number.isFinite(parsed.yearlyDollars)
      ? Math.round(parsed.yearlyDollars * 100)
      : null;

  const plan = await db.plan.upsert({
    where: { creatorId: creator.id },
    update: {
      monthlyPriceCents: monthlyCents,
      yearlyPriceCents: yearlyCents,
      trialDays: parsed.trialDays,
      active: parsed.active,
    },
    create: {
      creatorId: creator.id,
      monthlyPriceCents: monthlyCents,
      yearlyPriceCents: yearlyCents,
      trialDays: parsed.trialDays,
      active: parsed.active,
    },
  });

  // If the creator is Stripe-onboarded, sync Product + Prices on their account.
  // Best-effort: if Stripe rejects (network blip, archived account), the save
  // still succeeds — they can retry by saving again.
  try {
    await syncPlanToStripe(creator, plan);
  } catch (err) {
    console.error("[plan-sync] syncPlanToStripe failed", err);
  }

  revalidatePath("/studio/plan");
  revalidatePath(`/${creator.slug}`);
  redirect("/studio/plan?saved=plan");
}
