import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { purchaseCourseAction } from "@/lib/payments";

const schema = z.object({ courseId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = schema.parse(json);
    const result = await purchaseCourseAction(parsed.courseId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 },
    );
  }
}
