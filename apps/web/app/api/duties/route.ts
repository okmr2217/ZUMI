import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createDuty, listDuties } from "@/lib/duties";
import { dutyResultResponse, parseDutyInput, unauthorized } from "@/lib/duty-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorized();

  return NextResponse.json(await listDuties(getDb(), session.user.id));
}

/** Duty を作る。上限（ACTIVE と PAUSED で10件）に達していれば 409 `limit_reached` */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const parsed = await parseDutyInput(request);
  if (!parsed.ok) return parsed.response;

  const result = await createDuty(getDb(), session.user.id, parsed.input, new Date());
  return dutyResultResponse(result, 201);
}
