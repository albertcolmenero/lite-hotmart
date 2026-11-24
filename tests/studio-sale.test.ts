/**
 * Flow tests for saving sales from the studio: the real plan and course server
 * actions → sale-form → real local Postgres. Auth, cache revalidation and the
 * redirect are stubbed. Creators aren't on Stripe here, so no Stripe calls.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCreatorForCurrentUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { db } from "@/lib/db";
import { getCreatorForCurrentUser } from "@/lib/auth";
import { upsertPlanAction } from "@/app/studio/plan/actions";
import { createCourseAction } from "@/app/studio/courses/new/actions";
import { updateCourseAction } from "@/app/studio/courses/[id]/actions";
import {
  COURSE_SALE_FIELDS,
  parseSaleForm,
  planSaleFieldNames,
  saleFormDefaults,
} from "@/lib/sale-form";
import { truncateAll } from "./helpers";

const NOW = new Date("2026-11-24T12:00:00Z");
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function seedStudioCreator(tag: string) {
  const owner = await db.user.create({
    data: { clerkId: `clerk_${tag}`, email: `${tag}@test.local` },
  });
  const creator = await db.creator.create({
    data: { userId: owner.id, slug: `studio-${tag}`, displayName: `Studio ${tag}` },
  });
  return creator;
}

async function signInAs(creatorId: string) {
  vi.mocked(getCreatorForCurrentUser).mockResolvedValue(
    await db.creator.findUniqueOrThrow({ where: { id: creatorId } }),
  );
}

const planForm = (extra: Record<string, string> = {}) =>
  form({ currency: "usd", trialDays: "0", active: "on", price_monthly: "15", price_yearly: "150", ...extra });

const pricesOf = async (creatorId: string) =>
  db.planPrice.findMany({ where: { plan: { creatorId } }, orderBy: { intervalCount: "asc" } });

beforeEach(async () => {
  await truncateAll();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());
afterAll(() => db.$disconnect());

describe("plan sale", () => {
  it("saves a sale on one cadence with the shared window", async () => {
    const c = await seedStudioCreator("a");
    await signInAs(c.id);
    const m = planSaleFieldNames("monthly");
    await upsertPlanAction(
      planForm({
        [m.price]: "9",
        [m.duration!]: "periods",
        [m.periods!]: "3",
        sale_starts_at: iso(HOUR),
        sale_ends_at: iso(72 * HOUR),
      }),
    );

    const [monthly, yearly] = await pricesOf(c.id);
    expect(monthly).toMatchObject({
      interval: "month",
      priceCents: 1500,
      salePriceCents: 900,
      saleDuration: "periods",
      salePeriods: 3,
      saleStartsAt: new Date(iso(HOUR)),
      saleEndsAt: new Date(iso(72 * HOUR)),
    });
    expect(yearly).toMatchObject({ interval: "year", salePriceCents: null, saleDuration: null });
  });

  it("saves a forever sale without a period count", async () => {
    const c = await seedStudioCreator("a");
    await signInAs(c.id);
    const y = planSaleFieldNames("yearly");
    await upsertPlanAction(planForm({ [y.price]: "99", [y.duration!]: "forever", [y.periods!]: "4" }));
    const yearly = (await pricesOf(c.id)).find((p) => p.interval === "year")!;
    expect(yearly).toMatchObject({ salePriceCents: 9900, saleDuration: "forever", salePeriods: null });
  });

  it("clears a sale when its price is blanked", async () => {
    const c = await seedStudioCreator("a");
    await signInAs(c.id);
    const m = planSaleFieldNames("monthly");
    await upsertPlanAction(planForm({ [m.price]: "9", [m.duration!]: "forever" }));
    await upsertPlanAction(planForm({ [m.price]: "", [m.duration!]: "forever" }));
    const monthly = (await pricesOf(c.id)).find((p) => p.interval === "month")!;
    expect(monthly).toMatchObject({ salePriceCents: null, saleDuration: null, saleStartsAt: null });
  });

  it("rejects an invalid sale without saving anything", async () => {
    const c = await seedStudioCreator("a");
    await signInAs(c.id);
    const m = planSaleFieldNames("monthly");
    await expect(
      upsertPlanAction(planForm({ currency: "eur", [m.price]: "20", [m.duration!]: "forever" })),
    ).rejects.toThrow(/lower than the regular price/);

    expect(await db.plan.count()).toBe(0);
    expect((await db.creator.findUniqueOrThrow({ where: { id: c.id } })).currency).toBe("usd");
  });

  it("rejects a sale end in the past and a missing period count", async () => {
    const c = await seedStudioCreator("a");
    await signInAs(c.id);
    const m = planSaleFieldNames("monthly");
    await expect(
      upsertPlanAction(planForm({ [m.price]: "9", [m.duration!]: "forever", sale_ends_at: iso(-HOUR) })),
    ).rejects.toThrow(/in the future/);
    await expect(
      upsertPlanAction(planForm({ [m.price]: "9", [m.duration!]: "periods", [m.periods!]: "" })),
    ).rejects.toThrow(/billing periods/);
  });

  it("only writes to the signed-in creator's plan", async () => {
    const a = await seedStudioCreator("a");
    const b = await seedStudioCreator("b");
    await signInAs(b.id);
    await upsertPlanAction(planForm());
    await signInAs(a.id);
    const m = planSaleFieldNames("monthly");
    await upsertPlanAction(planForm({ [m.price]: "9", [m.duration!]: "forever" }));

    expect((await pricesOf(b.id)).every((p) => p.salePriceCents === null)).toBe(true);
    expect((await pricesOf(a.id)).find((p) => p.interval === "month")!.salePriceCents).toBe(900);
  });
});

describe("course sale", () => {
  const courseForm = (extra: Record<string, string> = {}) =>
    form({ title: "Hip openers", priceDollars: "50", published: "on", visibleToPublic: "on", ...extra });

  it("creates a course with a sale, then edits and clears it", async () => {
    const c = await seedStudioCreator("a");
    await signInAs(c.id);
    await createCourseAction(
      courseForm({ [COURSE_SALE_FIELDS.price]: "30", [COURSE_SALE_FIELDS.endsAt]: iso(48 * HOUR) }),
    );
    const course = await db.course.findFirstOrThrow({ where: { creatorId: c.id } });
    expect(course).toMatchObject({ priceCents: 5000, salePriceCents: 3000, saleEndsAt: new Date(iso(48 * HOUR)) });

    await updateCourseAction(courseForm({ id: course.id, [COURSE_SALE_FIELDS.price]: "25" }));
    expect(await db.course.findUniqueOrThrow({ where: { id: course.id } })).toMatchObject({
      salePriceCents: 2500,
      saleEndsAt: null,
    });

    await updateCourseAction(courseForm({ id: course.id, [COURSE_SALE_FIELDS.price]: "" }));
    expect((await db.course.findUniqueOrThrow({ where: { id: course.id } })).salePriceCents).toBeNull();
  });

  it("rejects a sale above the new regular price and leaves the course unchanged", async () => {
    const c = await seedStudioCreator("a");
    await signInAs(c.id);
    await createCourseAction(courseForm({ [COURSE_SALE_FIELDS.price]: "30" }));
    const course = await db.course.findFirstOrThrow({ where: { creatorId: c.id } });

    await expect(
      updateCourseAction(courseForm({ id: course.id, priceDollars: "25", [COURSE_SALE_FIELDS.price]: "30" })),
    ).rejects.toThrow(/lower than the regular price/);
    expect(await db.course.findUniqueOrThrow({ where: { id: course.id } })).toMatchObject({
      priceCents: 5000,
      salePriceCents: 3000,
    });
  });

  it("can't edit another creator's course", async () => {
    const a = await seedStudioCreator("a");
    const b = await seedStudioCreator("b");
    await signInAs(b.id);
    await createCourseAction(courseForm());
    const bCourse = await db.course.findFirstOrThrow({ where: { creatorId: b.id } });

    await signInAs(a.id);
    await expect(
      updateCourseAction(courseForm({ id: bCourse.id, [COURSE_SALE_FIELDS.price]: "1" })),
    ).rejects.toThrow(/Not found/);
    expect((await db.course.findUniqueOrThrow({ where: { id: bCourse.id } })).salePriceCents).toBeNull();
  });
});

describe("sale-form helpers", () => {
  it("parses blank as no sale and flags unreadable dates", () => {
    expect(parseSaleForm(form({}), COURSE_SALE_FIELDS)).toEqual({ kind: "none" });
    const bad = parseSaleForm(
      form({ [COURSE_SALE_FIELDS.price]: "10", [COURSE_SALE_FIELDS.endsAt]: "not a date" }),
      COURSE_SALE_FIELDS,
    );
    expect(bad).toEqual({ kind: "invalid", errors: [{ field: "saleEndsAt", message: "Enter a valid end date." }] });
  });

  it("shows an ended sale as no sale in the form", () => {
    const item = { salePriceCents: 900, saleEndsAt: new Date(iso(-1)) };
    expect(saleFormDefaults(item, NOW)).toBeNull();
    expect(saleFormDefaults({ ...item, saleEndsAt: new Date(iso(HOUR)) }, NOW)).not.toBeNull();
  });
});
