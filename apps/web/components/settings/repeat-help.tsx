/**
 * ヘルプ「繰り返し設定について」（docs/03 の繰り返しタイプ・境界ルール）。
 * 用語は追加シートの選択肢（ユーザーの言葉）に合わせ、内部の型名や「催促」は出さない。
 */
const TYPES: { label: string; body: string; example: string }[] = [
  { label: "毎日やる", body: "毎日が期日です。", example: "プロテイン・サプリ" },
  {
    label: "曜日が決まっている",
    body: "選んだ曜日が期日です。「隔週にする」で1週おきにもできます。",
    example: "ゴミ出し",
  },
  {
    label: "毎月やる",
    body: "毎月◯日か、第N◯曜日（第1〜4・最終）が期日です。29〜31日は、その日がない月は月末になります。",
    example: "エアコンフィルター掃除",
  },
  {
    label: "週に何回か",
    body: "曜日は決めず、週の中で回数をこなします。今日タブの「今週」に「あと1回・日曜まで」のように出ます。",
    example: "英語学習・家族への連絡",
  },
  {
    label: "前回やってから◯日空いたら",
    body: "前回「済」にした日から数えます。◯日たつと今日タブの「そろそろ」に出て、済ませるとそこから数え直します。",
    example: "お風呂・シーツ交換",
  },
];

const NOTES: { title: string; body: string }[] = [
  {
    title: "「そろそろ」とは",
    body: "期日の決まらないものは、毎日「今日」に出し続けません。前回から◯日たったときだけ「そろそろ」に出て、済ませたら消えます。間が空いても、済ませた日から数え直すので、できなかった分が積み上がりません。",
  },
  {
    title: "期日を過ぎたら",
    body: "期日のあるものは、過ぎても翌日に持ち越しません。済ませ忘れた日は、今日タブで過去の日を開くとあとから「済」にできます。",
  },
  {
    title: "週の区切り",
    body: "「週に何回か」と振り返りの達成率は、設定の「週の始まり」で区切ります。",
  },
];

export function RepeatHelp() {
  return (
    <div className="flex flex-col gap-4">
      <ul className="border-zumi-line bg-zumi-card overflow-hidden rounded-2xl border">
        {TYPES.map((type) => (
          <li key={type.label} className="border-zumi-line border-b px-[15px] py-3 last:border-b-0">
            <p className="text-[13.5px] font-semibold">{type.label}</p>
            <p className="mt-1 text-[12px] leading-relaxed">{type.body}</p>
            <p className="text-zumi-soft mt-1 text-[11px]">例: {type.example}</p>
          </li>
        ))}
      </ul>
      {NOTES.map((note) => (
        <section key={note.title} className="flex flex-col gap-1">
          <h3 className="text-[13.5px] font-bold">{note.title}</h3>
          <p className="text-[12px] leading-relaxed">{note.body}</p>
        </section>
      ))}
    </div>
  );
}
