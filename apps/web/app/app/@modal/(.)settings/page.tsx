import { SettingsPanel } from "@/components/settings/settings-panel";
import { getSettingsPanelData } from "@/lib/settings-page-data";

/**
 * 今日タブの歯車からの遷移を横取りして、設定をモーダルで開く（直接開いたときは `settings/page.tsx`）。
 * シートの枠は `layout.tsx` にある
 */
export default async function SettingsModalPage() {
  const data = await getSettingsPanelData();
  return <SettingsPanel {...data} />;
}
