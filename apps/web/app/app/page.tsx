import { TodayPager } from "@/components/today/today-pager";
import { getTodayPageData } from "@/lib/today-page-data";
import { getVapidPublicKey } from "@/lib/vapid";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { date: param } = await searchParams;
  const { today, day } = await getTodayPageData(typeof param === "string" ? param : undefined);

  return (
    <main>
      <TodayPager initial={day} today={today} vapidPublicKey={getVapidPublicKey()} />
    </main>
  );
}
