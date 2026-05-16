import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";

// Clerk webhook → mirror users into our DB.
// Set CLERK_WEBHOOK_SECRET in env and configure the endpoint in Clerk dashboard.
export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "no secret" }, { status: 500 });

  const headerPayload = req.headers;
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "missing svix headers" }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(secret);
  let evt: { type: string; data: Record<string, unknown> };
  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const data = evt.data as {
      id: string;
      email_addresses: { email_address: string; id: string }[];
      primary_email_address_id: string | null;
      first_name: string | null;
      last_name: string | null;
      image_url: string | null;
    };
    const primary =
      data.email_addresses.find((e) => e.id === data.primary_email_address_id) ??
      data.email_addresses[0];
    if (!primary) return NextResponse.json({ ok: true });

    await db.user.upsert({
      where: { clerkId: data.id },
      update: {
        email: primary.email_address,
        name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
        imageUrl: data.image_url,
      },
      create: {
        clerkId: data.id,
        email: primary.email_address,
        name: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
        imageUrl: data.image_url,
      },
    });
  }

  if (evt.type === "user.deleted") {
    const data = evt.data as { id: string };
    await db.user.deleteMany({ where: { clerkId: data.id } });
  }

  return NextResponse.json({ ok: true });
}
