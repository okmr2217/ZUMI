import { redirect } from "next/navigation";
import { toLocalDate } from "@zumi/types";
import { getServerSession } from "./auth";
import { getDb } from "./db";
import { getSchedulePreviewData, getUserCalendar, listDuties } from "./duties";
import { DUTY_LIMIT } from "./duty-input";

/**
 * Duty タブ・テンプレート画面の Server Component が使うデータ。
 * 編集シートの「次の期日」のプレビュー用に、アーカイブしていない Duty の一時停止期間と最近のログも添える。
 */
export async function getDutyPageData() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const db = getDb();
  const [{ timeZone, weekStart }, rows] = await Promise.all([
    getUserCalendar(db, userId),
    listDuties(db, userId),
  ]);
  const today = toLocalDate(new Date(), timeZone);
  const current = rows.filter((duty) => duty.status !== "ARCHIVED");
  const preview = await getSchedulePreviewData(
    db,
    userId,
    current.map((duty) => duty.id),
    today,
  );

  const toItem = (duty: (typeof rows)[number]) => ({
    id: duty.id,
    name: duty.name,
    icon: duty.icon,
    scheduleConfig: duty.scheduleConfig,
    notifyPrevNight: duty.notifyPrevNight,
    noteEnabled: duty.noteEnabled,
    status: duty.status,
    createdAt: duty.createdAt,
    pauses: preview.pauses
      .filter((pause) => pause.dutyId === duty.id)
      .map(({ startDate, endDate }) => ({ startDate, endDate })),
    logs: preview.logs
      .filter((log) => log.dutyId === duty.id)
      .map(({ targetDate, status }) => ({ targetDate, status })),
  });

  return {
    calendar: { today, timeZone, weekStart },
    duties: current.map(toItem),
    archived: rows.filter((duty) => duty.status === "ARCHIVED").map(toItem),
    limitReached: current.length >= DUTY_LIMIT,
  };
}
