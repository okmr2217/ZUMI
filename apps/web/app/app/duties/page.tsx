import { getDutyPageData } from "@/lib/duty-page-data";
import { DutyList } from "@/components/duty/duty-list";

export default async function DutiesPage() {
  const data = await getDutyPageData();
  return <DutyList {...data} />;
}
