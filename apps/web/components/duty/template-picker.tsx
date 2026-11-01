"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { DutyTemplate } from "@zumi/types";
import { DutyCreateSheet, type DutyCalendar } from "./duty-create-sheet";
import { dutyDraftFromTemplate } from "./duty-draft";
import { LIMIT_MESSAGE } from "./duty-api-client";
import { TemplateGrid } from "./template-grid";

/**
 * テンプレート画面（Duty タブの「テンプレートから作成する」の行き先）。
 * オンボーディングと同じカードのレイアウトだが、「ようこそ」や「次へ」は持たない。
 * カードをタップすると内容が入った追加シートが開き、追加すると Duty 一覧に戻る。
 */
export function TemplatePicker({
  calendar,
  limitReached,
}: {
  calendar: DutyCalendar;
  limitReached: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<DutyTemplate | null>(null);

  return (
    <main>
      <header className="flex items-center gap-1 px-3.5 pb-1 pt-[22px]">
        <Link
          href="/app/duties"
          aria-label="Duty 一覧に戻る"
          className="text-zumi-soft flex size-9 items-center justify-center rounded-full"
        >
          <ChevronLeft className="size-5" strokeWidth={1.8} aria-hidden />
        </Link>
        <h1 className="text-[20px] font-bold">テンプレートから作成</h1>
      </header>
      <p className="text-zumi-soft px-[22px] text-[12.5px]">
        選ぶと、内容が入った状態で追加画面が開きます。
      </p>

      <div className="px-5 pt-[18px]">
        {limitReached && (
          <p
            role="alert"
            className="bg-zumi-pill mb-3 rounded-xl px-[13px] py-2.5 text-[12.5px] font-semibold"
          >
            {LIMIT_MESSAGE}
          </p>
        )}
        <TemplateGrid
          onSelect={setSelected}
          weekStart={calendar.weekStart}
          disabled={limitReached}
        />
      </div>

      <DutyCreateSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        onCreated={() => {
          router.push("/app/duties");
          router.refresh();
        }}
        calendar={calendar}
        initialDraft={selected ? dutyDraftFromTemplate(selected, calendar.today) : undefined}
      />
    </main>
  );
}
