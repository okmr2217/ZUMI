import { sendJson } from "@/lib/api-client";
import type { LogInput } from "@/lib/log-input";

export type { ApiResult as LogApiResult } from "@/lib/api-client";

const logUrl = (dutyId: string, date: string) =>
  `/api/duties/${encodeURIComponent(dutyId)}/logs/${date}`;

/** `LogInput` は送信前の形（`note` の空文字は API 側で null にする） */
export const recordLogRequest = (dutyId: string, date: string, input: LogInput) =>
  sendJson(logUrl(dutyId, date), "PUT", input);

export const deleteLogRequest = (dutyId: string, date: string) =>
  sendJson(logUrl(dutyId, date), "DELETE");

export function logErrorMessage(error: string): string {
  switch (error) {
    case "already_logged":
      return "その日にはすでに記録があります。";
    case "invalid_date":
      return "記録できるのは、作成した日から今日までです。";
    case "not_found":
    case "invalid_state":
      return "この Duty の状態が変わっています。画面を読み込み直してください。";
    case "network":
      return "通信できませんでした。電波の良いところでもう一度お試しください。";
    default:
      return "記録できませんでした。時間をおいてもう一度お試しください。";
  }
}
