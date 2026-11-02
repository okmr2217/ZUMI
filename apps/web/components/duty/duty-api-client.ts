import { sendJson } from "@/lib/api-client";
import type { DutyInput } from "@/lib/duty-input";

export const createDutyRequest = (input: DutyInput) => sendJson("/api/duties", "POST", input);

export const updateDutyRequest = (id: string, input: DutyInput) =>
  sendJson(`/api/duties/${encodeURIComponent(id)}`, "PATCH", input);

export const changeDutyStatusRequest = (id: string, action: "pause" | "resume" | "archive") =>
  sendJson(`/api/duties/${encodeURIComponent(id)}/status`, "POST", { action });

export const LIMIT_MESSAGE = "Duty は10件までです。アーカイブすると枠が空きます。";

export function errorMessage(error: string): string {
  switch (error) {
    case "limit_reached":
      return LIMIT_MESSAGE;
    case "invalid_input":
      return "入力内容を確認してください。";
    case "not_found":
      return "この Duty は見つかりませんでした。画面を読み込み直してください。";
    case "invalid_state":
      return "この Duty の状態が変わっています。画面を読み込み直してください。";
    case "network":
      return "通信できませんでした。電波の良いところでもう一度お試しください。";
    default:
      return "保存できませんでした。時間をおいてもう一度お試しください。";
  }
}
