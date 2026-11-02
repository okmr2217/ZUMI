import { TodayHeader } from "@/components/today/today-header";
import { TodayView } from "@/components/today/today-view";
import { getTodayPageData } from "@/lib/today-page-data";
import { getVapidPublicKey } from "@/lib/vapid";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { date: param } = await searchParams;
  const data = await getTodayPageData(typeof param === "string" ? param : undefined);

  return (
    <main>
      <TodayHeader date={data.date} today={data.today} mode={data.mode} />
      {/* 日付ごとに作り直し、前の日の楽観的な状態や送信中のリクエストを持ち越さない */}
      <TodayView
        key={data.date}
        {...data}
        vapidPublicKey={data.mode === "today" ? getVapidPublicKey() : null}
      />
    </main>
  );
}
