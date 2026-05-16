"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  addDomainToProject,
  removeDomainFromProject,
  verifyDomain,
  IS_DEV_BYPASS_VERCEL,
} from "@/lib/vercel";
import { invalidateHostCache } from "@/lib/host-resolver";

const domainSchema = z
  .string()
  .min(4)
  .max(253)
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a valid domain like studio.example.com")
  .transform((s) => s.toLowerCase().trim());

export async function addCustomDomainAction(formData: FormData) {
  const creator = await getCreatorForCurrentUser();
  if (!creator) throw new Error("No creator");
  const raw = String(formData.get("domain") ?? "").trim();
  const domain = domainSchema.parse(raw);

  // Block conflicts with the platform root domain
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").toLowerCase();
  if (root && (domain === root || domain.endsWith(`.${root}`))) {
    throw new Error("Choose a domain that isn't on the platform's root.");
  }

  // Reject if already owned by someone else
  const existing = await db.creator.findUnique({ where: { customDomain: domain } });
  if (existing && existing.id !== creator.id) {
    throw new Error("That domain is already connected to another creator.");
  }

  // Tell Vercel about it
  await addDomainToProject(domain);

  await db.creator.update({
    where: { id: creator.id },
    data: {
      customDomain: domain,
      customDomainStatus: IS_DEV_BYPASS_VERCEL ? "active" : "pending_verification",
      customDomainAddedAt: new Date(),
      customDomainVerifiedAt: IS_DEV_BYPASS_VERCEL ? new Date() : null,
    },
  });

  invalidateHostCache(domain);
  revalidatePath("/studio/domain");
  redirect("/studio/domain?saved=domain-added");
}

export async function verifyCustomDomainAction() {
  const creator = await getCreatorForCurrentUser();
  if (!creator?.customDomain) throw new Error("No domain to verify.");

  const { ready, vercel, config } = await verifyDomain(creator.customDomain);

  let nextStatus: "pending_dns" | "pending_verification" | "verified" | "active" | "error";
  if (ready) {
    nextStatus = "active";
  } else if (config.misconfigured) {
    nextStatus = "pending_dns";
  } else if (vercel && !vercel.verified) {
    nextStatus = "pending_verification";
  } else {
    nextStatus = "error";
  }

  await db.creator.update({
    where: { id: creator.id },
    data: {
      customDomainStatus: nextStatus,
      customDomainVerifiedAt: ready ? new Date() : creator.customDomainVerifiedAt,
    },
  });

  invalidateHostCache(creator.customDomain);
  revalidatePath("/studio/domain");
  redirect(`/studio/domain?saved=${ready ? "domain-active" : "domain-checked"}`);
}

export async function removeCustomDomainAction() {
  const creator = await getCreatorForCurrentUser();
  if (!creator?.customDomain) return;

  try {
    await removeDomainFromProject(creator.customDomain);
  } catch (err) {
    console.error("[domain] vercel remove failed", err);
  }
  invalidateHostCache(creator.customDomain);

  await db.creator.update({
    where: { id: creator.id },
    data: {
      customDomain: null,
      customDomainStatus: null,
      customDomainAddedAt: null,
      customDomainVerifiedAt: null,
    },
  });
  revalidatePath("/studio/domain");
  redirect("/studio/domain?saved=domain-removed");
}
