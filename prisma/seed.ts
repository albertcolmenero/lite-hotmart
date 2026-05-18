import { PrismaClient, type VideoProvider } from "@prisma/client";

const db = new PrismaClient();

const DEV_CLERK_ID = "dev_user_local";
const DEV_EMAIL = "dev@local.test";
const DEV_NAME = "Francesca Golfetto";
const DEV_SLUG = "dev";

const DEMO_VIDEO = "https://www.youtube.com/watch?v=v7AYKMP6rOE"; // free yoga sample

async function main() {
  // 1. Dev user (creator + subscriber to themselves)
  const user = await db.user.upsert({
    where: { clerkId: DEV_CLERK_ID },
    update: {},
    create: {
      clerkId: DEV_CLERK_ID,
      email: DEV_EMAIL,
      name: DEV_NAME,
    },
  });

  // 2. Creator profile
  const creator = await db.creator.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      slug: DEV_SLUG,
      displayName: DEV_NAME,
      bio: "Filmmaker teaching color grading. (Seeded V2 dev data.)",
      accentColor: "#6366f1",
      published: false, // start as draft so /studio/publish flow is testable
    },
  });

  // 3. Plan
  const plan = await db.plan.upsert({
    where: { creatorId: creator.id },
    update: {},
    create: {
      creatorId: creator.id,
      monthlyPriceCents: 3000, // $30
      yearlyPriceCents: 25000, // $250
      currency: "usd",
      trialDays: 0,
      active: true,
    },
  });

  // 4. Tags
  const tagDefs = [
    { slug: "all-levels", name: "All-Levels" },
    { slug: "flexibility", name: "Flexibility" },
    { slug: "mobility", name: "Mobility" },
    { slug: "hips", name: "Hips" },
    { slug: "fluidity", name: "Fluidity" },
    { slug: "creative", name: "Creative" },
    { slug: "tension-release", name: "Tension Release" },
  ];
  const tags: Record<string, { id: string }> = {};
  for (const t of tagDefs) {
    const tag = await db.tag.upsert({
      where: { creatorId_slug: { creatorId: creator.id, slug: t.slug } },
      update: { name: t.name },
      create: { creatorId: creator.id, slug: t.slug, name: t.name },
    });
    tags[t.slug] = tag;
  }

  // 5. Classes
  const classDefs = [
    { slug: "hips-360", title: "Hips 360", duration: 55, tagSlugs: ["all-levels", "flexibility", "mobility", "hips", "fluidity", "tension-release", "creative"], visible: true },
    { slug: "juicy-body-flow", title: "Juicy Body Flow", duration: 57, tagSlugs: ["all-levels", "fluidity", "creative"], visible: true },
    { slug: "flow-play-lift", title: "Flow, play, lift", duration: 50, tagSlugs: ["all-levels", "mobility"], visible: true },
    { slug: "full-body-expansion", title: "Full Body Expansion", duration: 47, tagSlugs: ["all-levels", "fluidity"], visible: true },
    { slug: "strong-light-legs", title: "Strong & Light Legs", duration: 48, tagSlugs: ["all-levels", "mobility"], visible: true },
    { slug: "twist-and-let-go", title: "Twist and let go", duration: 31, tagSlugs: ["tension-release"], visible: true },
    { slug: "upside-down-mobility", title: "Upside Down Mobility", duration: 50, tagSlugs: ["mobility", "creative"], visible: true },
    { slug: "deep-stretch-private", title: "Deep Stretch (members preview)", duration: 25, tagSlugs: ["flexibility"], visible: false },
  ];

  const classes: Record<string, { id: string }> = {};
  for (const c of classDefs) {
    const cls = await db.class.upsert({
      where: { creatorId_slug: { creatorId: creator.id, slug: c.slug } },
      update: {},
      create: {
        creatorId: creator.id,
        slug: c.slug,
        title: c.title,
        description: `${c.title} — a guided class. (Seeded data.)`,
        videoProvider: "youtube" as VideoProvider,
        videoUrl: DEMO_VIDEO,
        durationMins: c.duration,
        visibleToPublic: c.visible,
        published: true,
        publishedAt: new Date(),
        tags: { connect: c.tagSlugs.map((s) => ({ creatorId_slug: { creatorId: creator.id, slug: s } })) },
      },
    });
    classes[c.slug] = cls;
  }

  // 6. Series — "New classes" + "Soft flows"
  const newClassesSeries = await db.series.upsert({
    where: { creatorId_slug: { creatorId: creator.id, slug: "new-classes" } },
    update: {},
    create: {
      creatorId: creator.id,
      slug: "new-classes",
      title: "New classes",
      description: "Here you can find all my latest additions to studio.",
      visibleToPublic: true,
      published: true,
      publishedAt: new Date(),
      tags: { connect: [{ creatorId_slug: { creatorId: creator.id, slug: "all-levels" } }] },
    },
  });
  const softFlowsSeries = await db.series.upsert({
    where: { creatorId_slug: { creatorId: creator.id, slug: "soft-flows" } },
    update: {},
    create: {
      creatorId: creator.id,
      slug: "soft-flows",
      title: "Soft flows",
      description: "Gentle flows for restorative practice.",
      visibleToPublic: true,
      published: true,
      publishedAt: new Date(),
      tags: { connect: [{ creatorId_slug: { creatorId: creator.id, slug: "all-levels" } }] },
    },
  });

  await db.seriesClass.deleteMany({ where: { seriesId: newClassesSeries.id } });
  for (const [i, slug] of [
    "hips-360", "juicy-body-flow", "flow-play-lift", "full-body-expansion", "strong-light-legs", "twist-and-let-go", "upside-down-mobility",
  ].entries()) {
    await db.seriesClass.create({
      data: { seriesId: newClassesSeries.id, classId: classes[slug].id, position: i },
    });
  }
  await db.seriesClass.deleteMany({ where: { seriesId: softFlowsSeries.id } });
  for (const [i, slug] of ["full-body-expansion", "twist-and-let-go", "juicy-body-flow"].entries()) {
    await db.seriesClass.create({
      data: { seriesId: softFlowsSeries.id, classId: classes[slug].id, position: i },
    });
  }

  // 7. Courses (3 — match the screenshots)
  const courseDefs = [
    { slug: "fluid-flexibility-yoga-challenge", title: "21 Day Fluid Flexibility Yoga Challenge", priceCents: 10000, eyebrow: null, description: "Ready to move with grace, freedom and flow?\n\nJoin me for 21 days of empowering movement, designed especially for beginners who are curious about building strength and flexibility…in fluid motion.", classSlugs: ["hips-360", "juicy-body-flow", "flow-play-lift", "full-body-expansion", "strong-light-legs"] },
    { slug: "seven-chakras", title: "The Seven Chakras - Fluid Flexibilty Series", priceCents: 15000, eyebrow: null, description: "A 7-class journey through each chakra.", classSlugs: ["full-body-expansion", "twist-and-let-go", "upside-down-mobility"] },
    { slug: "flexibility-formula", title: "The Flexibility Formula", priceCents: 1000, eyebrow: "ELEVATE YOUR FLEXIBILITY", description: "A short program for daily flexibility gains.", classSlugs: ["strong-light-legs", "hips-360"] },
  ];

  for (const c of courseDefs) {
    const course = await db.course.upsert({
      where: { creatorId_slug: { creatorId: creator.id, slug: c.slug } },
      update: {},
      create: {
        creatorId: creator.id,
        slug: c.slug,
        title: c.title,
        eyebrow: c.eyebrow,
        description: c.description,
        priceCents: c.priceCents,
        currency: "usd",
        visibleToPublic: true,
        published: true,
        publishedAt: new Date(),
      },
    });
    await db.courseClass.deleteMany({ where: { courseId: course.id } });
    for (const [i, slug] of c.classSlugs.entries()) {
      await db.courseClass.create({
        data: {
          courseId: course.id,
          classId: classes[slug].id,
          position: i,
          moduleLabel: i === 0 ? "MODULE 1" : null,
        },
      });
    }
  }

  // 7b. Sample category — "Flexibility" — connecting a couple of items
  const flexibility = await db.category.upsert({
    where: { creatorId_slug: { creatorId: creator.id, slug: "flexibility" } },
    update: {},
    create: {
      creatorId: creator.id,
      slug: "flexibility",
      name: "Flexibility",
      description: "Mobility, deep stretch, and mindful unfurling.",
      classes: {
        connect: [
          { id: classes["hips-360"].id },
          { id: classes["strong-light-legs"].id },
        ],
      },
      series: {
        connect: [
          { creatorId_slug: { creatorId: creator.id, slug: "soft-flows" } },
        ],
      },
      courses: {
        connect: [
          {
            creatorId_slug: {
              creatorId: creator.id,
              slug: "flexibility-formula",
            },
          },
        ],
      },
    },
  });

  // 7c. Default menu items (Practice, Courses, Flexibility category, Favourites)
  await db.menuItem.deleteMany({ where: { creatorId: creator.id } });
  await db.menuItem.createMany({
    data: [
      { creatorId: creator.id, name: "Practice", type: "PAGE", pageKey: "practice", position: 0 },
      { creatorId: creator.id, name: "Courses", type: "PAGE", pageKey: "courses", position: 1 },
      { creatorId: creator.id, name: "Flexibility", type: "CATEGORY", categoryId: flexibility.id, position: 2 },
      { creatorId: creator.id, name: "Favourites", type: "FAVOURITES", position: 3 },
    ],
  });

  // 8. Dev user as active subscriber to themselves (so /library has content)
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const sub = await db.subscription.upsert({
    where: { id: "sub_dev_local" },
    update: {},
    create: {
      id: "sub_dev_local",
      userId: user.id,
      planId: plan.id,
      interval: "month",
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  await db.entitlement.upsert({
    where: { id: "ent_dev_sub" },
    update: { expiresAt: periodEnd, creatorId: creator.id, subscriptionId: sub.id },
    create: {
      id: "ent_dev_sub",
      userId: user.id,
      source: "subscription",
      creatorId: creator.id,
      subscriptionId: sub.id,
      expiresAt: periodEnd,
    },
  });

  // 9. Bootstrap super-admin role. Idempotent — no-op if the user doesn't
  // exist on this DB yet (e.g. first run on a fresh stage). Once the user
  // signs in once, the role sticks.
  const promotedRows = await db.user.updateMany({
    where: { email: "albert.colmenero@gmail.com" },
    data: { role: "super_admin" },
  });
  if (promotedRows.count > 0) {
    console.log(`  - albert.colmenero@gmail.com promoted to super_admin`);
  }

  console.log(`✓ Seeded V2 dev data:`);
  console.log(`  - 1 creator (@${creator.slug})`);
  console.log(`  - 1 plan ($${plan.monthlyPriceCents! / 100}/mo, $${plan.yearlyPriceCents! / 100}/yr)`);
  console.log(`  - ${classDefs.length} classes (${classDefs.filter((c) => c.visible).length} visible)`);
  console.log(`  - 2 series, 3 courses, ${tagDefs.length} tags`);
  console.log(`  - 1 category (flexibility), 4 default menu items`);
  console.log(`  - dev user subscribed to themselves`);
  console.log(``);
  console.log(`  Visit:`);
  console.log(`    http://localhost:3000/${creator.slug}            (storefront landing)`);
  console.log(`    http://localhost:3000/${creator.slug}/practice   (practice tab)`);
  console.log(`    http://localhost:3000/${creator.slug}/courses    (courses tab)`);
  console.log(`    http://localhost:3000/studio                     (creator dashboard)`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
