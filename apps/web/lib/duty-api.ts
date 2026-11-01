import { NextResponse } from "next/server";
import { dutyInputSchema, type DutyInput } from "./duty-input";
import type { DutyError, DutyResult } from "./duties";

/** Duty API のエラー。`error` は画面側で文言を出し分けるためのコード */
const ERROR_STATUS: Record<DutyError, number> = {
  not_found: 404,
  invalid_state: 409,
  limit_reached: 409,
};

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function dutyResultResponse<T>(result: DutyResult<T>, successStatus = 200) {
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: ERROR_STATUS[result.error] });
  }
  return result.value === undefined
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json(result.value, { status: successStatus });
}

/** リクエストの JSON を `dutyInputSchema` で検証する。失敗したら 400 のレスポンスを返す */
export async function parseDutyInput(
  request: Request,
): Promise<{ ok: true; input: DutyInput } | { ok: false; response: NextResponse }> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = dutyInputSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid_input" }, { status: 400 }),
    };
  }
  return { ok: true, input: parsed.data };
}
