import { SettingsModal } from "@/components/settings/settings-modal";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { getSettingsPanelData } from "@/lib/settings-page-data";

/** 今日タブの歯車からの遷移を横取りして、設定をモーダルで開く（直接開いたときは `settings/page.tsx`） */
export default async function SettingsModalPage() {
  const data = await getSettingsPanelData();
  return (
    <SettingsModal>
      <SettingsPanel {...data} />
    </SettingsModal>
  );
}
