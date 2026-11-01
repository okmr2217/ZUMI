import { redirect } from "next/navigation";
import type { SettingsPanelData } from "@/components/settings/settings-panel";
import { getServerSession } from "./auth";
import { getNotificationSettings } from "./notification-settings";
import { getVapidPublicKey } from "./vapid";

/** 設定モーダル・設定ページのデータ */
export async function getSettingsPanelData(): Promise<SettingsPanelData> {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return {
    email: session.user.email,
    notificationSettings: await getNotificationSettings(session.user.id),
    vapidPublicKey: getVapidPublicKey(),
  };
}
