import { z } from "zod";
import { presetIconNameSchema, scheduleConfigSchema } from "@zumi/types";

/** Duty 名の最大文字数。一覧カード・今日タブ・シェア画像で1行に収まる長さにする */
export const DUTY_NAME_MAX_LENGTH = 30;

/**
 * MVP 中の Duty 上限（docs/06-billing.md「MVPでのスコープ」）。
 * ACTIVE と PAUSED を数え、ARCHIVED は数えない（一時停止で上限を回避できないようにするため）。
 */
export const DUTY_LIMIT = 10;

/**
 * Duty の作成・編集の入力。追加シートと編集フォームが同じ形で送る。
 * `scheduleType` は受け取らず、保存時に `scheduleConfig.type` から決める
 * （2つを別々に受け取ると食い違いうるため）。
 */
export const dutyInputSchema = z.object({
  name: z.string().trim().min(1).max(DUTY_NAME_MAX_LENGTH),
  icon: presetIconNameSchema,
  scheduleConfig: scheduleConfigSchema,
  notifyPrevNight: z.boolean(),
  noteEnabled: z.boolean(),
});

export type DutyInput = z.infer<typeof dutyInputSchema>;
