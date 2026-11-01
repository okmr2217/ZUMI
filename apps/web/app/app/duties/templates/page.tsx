import { getTemplatePageData } from "@/lib/duty-page-data";
import { TemplatePicker } from "@/components/duty/template-picker";

export default async function DutyTemplatesPage() {
  const { calendar, limitReached } = await getTemplatePageData();
  return <TemplatePicker calendar={calendar} limitReached={limitReached} />;
}
