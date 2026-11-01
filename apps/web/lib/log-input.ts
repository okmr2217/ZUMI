import { z } from "zod";
import { addDays } from "@zumi/types";

/** メモの上限。「1タップで済」の補助なので短く抑える */
export const NOTE_MAX_LENGTH = 200;

/** 実在する日付の `YYYY-MM-DD` か（`2026-02-30` などは弾く） */
export function isLocalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
}

const localDate = z.string().refine(isLocalDate);

/**
 * 記録 API（`PUT /api/duties/:id/logs/:date`）の body。
 * - `note`: 送ったときだけ書き換える（ワンタップの押印では送らず、既存のメモを消さない）。空文字は null
 * - `moveFrom`: 対象日の変更。その日のログを `:date` に移す
 */
export const logInputSchema = z
  .object({
    status: z.enum(["DONE", "SKIP"]),
    note: z
      .string()
      .max(NOTE_MAX_LENGTH)
      .nullable()
      .transform((note) => (note?.trim() ? note.trim() : null))
      .optional(),
    moveFrom: localDate.optional(),
  })
  .strict();

export type LogInput = z.infer<typeof logInputSchema>;
