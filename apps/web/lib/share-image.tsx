import { isValidElement, type ReactNode } from "react";
import { ImageResponse } from "next/og";
import { DutyIcon } from "@/components/duty/duty-icon";
import { formatPeriod } from "./date-label";
import { loadShareFonts, SEAL_FONT } from "./og-fonts";
import type { ShareCard, ShareCardDuty } from "./share";

/**
 * シェア画像のテンプレート（標準テーマ）。見た目は振り返りタブの週次サマリーカード（モック `ReviewSummary` の
 * `.summary-card`）を、SNS 向けの縦長 4:5 に引き伸ばしたもの。
 *
 * - 前週比を主役にする（済んだ数と並ぶ大きさで、色を付ける）。減ったときも責める色にはしない
 * - 未達の Duty も隠さない（破線の円で「あと N」「来週」）
 * - 「済」の朱印の角度は、トークンから決まる乱数でずらす（同じ URL なら同じ画像になる）
 * - フッターにドメインを焼き込む。ストリークは出さない
 */

/** 4:5。Instagram のフィードで切られない最も縦長の比率で、X・Threads でも切られずに出る */
export const SHARE_IMAGE_SIZE = { width: 1080, height: 1350 } as const;

const INK = "#2B2620";
const SOFT = "#8A8072";
const PAPER = "#FAF6EF";
const CARD = "#FFFFFF";
const LINE = "#E7DFCE";
const SHU = "#C8402A";
const PILL = "#F0ECE0";
const SUCCESS = "#5D7A49";
const SUCCESS_BG = "#E4ECDD";
const GOTHIC = "Zen Kaku Gothic New";

/** 行の大きさ。Duty が多いときは詰めて、それでも入らない分は「ほか N件」にまとめる */
const ROW_LAYOUTS = {
  regular: { maxRows: 5, padding: 20, seal: 88, sealFont: 42, icon: 40, name: 34, sub: 25 },
  compact: { maxRows: 7, padding: 10, seal: 64, sealFont: 30, icon: 34, name: 30, sub: 22 },
} as const;
type RowLayout = (typeof ROW_LAYOUTS)[keyof typeof ROW_LAYOUTS];

/** トークンから決まる 0〜1 の乱数列（mulberry32） */
function seededRandom(seed: string): () => number {
  let state = 0;
  for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** 朱印の傾き。手で押したように ±3〜10° の範囲でずらす */
function sealRotations(seed: string, count: number): number[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const degrees = 3 + random() * 7;
    return random() < 0.5 ? -degrees : degrees;
  });
}

export function ShareImage({ card, seed }: { card: ShareCard; seed: string }) {
  const layout =
    card.duties.length > ROW_LAYOUTS.regular.maxRows ? ROW_LAYOUTS.compact : ROW_LAYOUTS.regular;
  const overflow = card.duties.length > layout.maxRows;
  const shown = overflow ? card.duties.slice(0, layout.maxRows - 1) : card.duties;
  const rest = card.duties.slice(shown.length);
  const rotations = sealRotations(seed, shown.length);

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 64,
        background: PAPER,
        fontFamily: GOTHIC,
        color: INK,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "72px 64px 52px",
          background: CARD,
          border: `2px solid ${LINE}`,
          borderRadius: 44,
          boxShadow: "0 28px 64px rgba(30,26,20,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 40,
            fontSize: 32,
            color: SOFT,
          }}
        >
          <span style={{ letterSpacing: 2 }}>{formatPeriod(card.weekStart, card.weekEnd)}</span>
          <span style={{ opacity: 0.65 }}>第{card.weekNumber}週</span>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <span style={{ fontSize: 132, fontWeight: 500, lineHeight: 1 }}>{card.done}</span>
            <span style={{ fontSize: 50, color: SOFT }}>/ {card.total}</span>
          </div>
          <DiffBadge diff={card.diff} />
        </div>
        <div
          style={{ display: "flex", marginTop: 18, marginBottom: 36, fontSize: 32, color: SOFT }}
        >
          {card.caption}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            borderTop: `2px solid ${LINE}`,
            overflow: "hidden",
          }}
        >
          {shown.map((duty, index) => (
            <DutyRow
              key={index}
              duty={duty}
              layout={layout}
              rotation={rotations[index]!}
              isCurrentWeek={card.isCurrentWeek}
              last={index === shown.length - 1 && rest.length === 0}
            />
          ))}
          {rest.length > 0 && <RestRow rest={rest} layout={layout} />}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 30,
            borderTop: `2px solid ${LINE}`,
          }}
        >
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: 4 }}>ZUMI</span>
          <span style={{ fontSize: 28, color: SOFT }}>zumi.paritto.dev</span>
        </div>
      </div>
    </div>
  );
}

/** 前週比（済んだ数の差）。増えたときだけ緑、同じ・減ったときは中立の色 */
function DiffBadge({ diff }: { diff: number }) {
  const up = diff > 0;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginLeft: "auto",
        padding: "18px 34px 22px",
        borderRadius: 32,
        background: up ? SUCCESS_BG : PILL,
        color: up ? SUCCESS : SOFT,
      }}
    >
      <span style={{ fontSize: 26, fontWeight: 700 }}>先週より</span>
      <span style={{ fontSize: diff === 0 ? 56 : 92, fontWeight: 700, lineHeight: 1.1 }}>
        {diff === 0 ? "同じ" : `${up ? "+" : "−"}${Math.abs(diff)}`}
      </span>
    </div>
  );
}

function DutyRow({
  duty,
  layout,
  rotation,
  isCurrentWeek,
  last,
}: {
  duty: ShareCardDuty;
  layout: RowLayout;
  rotation: number;
  isCurrentWeek: boolean;
  last: boolean;
}) {
  const complete = duty.done >= duty.total;
  // 未達の名前を薄くするのは終わった週だけ（今週はまだ途中のため。振り返りタブのカードと同じ）
  const missed = !complete && !isCurrentWeek;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 26,
        padding: `${layout.padding}px 0`,
        borderBottom: last ? "none" : `2px solid ${LINE}`,
      }}
    >
      <DutyIcon
        name={duty.icon}
        size={layout.icon}
        color={SOFT}
        strokeWidth={1.6}
        style={{ flexShrink: 0 }}
      />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: layout.name,
            lineHeight: 1.3,
            color: missed ? SOFT : INK,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {duty.name}
        </span>
        <span style={{ marginTop: 4, fontSize: layout.sub, lineHeight: 1.3, color: SOFT }}>
          {duty.schedule} · {duty.done}/{duty.total}
        </span>
      </div>
      {complete ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: layout.seal,
            height: layout.seal,
            flexShrink: 0,
            // 傾けた朱印が行の右端で切れないように
            marginRight: 6,
            borderRadius: "50%",
            border: `4px solid ${SHU}`,
            color: SHU,
            fontFamily: SEAL_FONT,
            fontSize: layout.sealFont,
            transform: `rotate(${rotation.toFixed(1)}deg)`,
          }}
        >
          済
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: layout.seal,
            height: layout.seal,
            flexShrink: 0,
            marginRight: 6,
            borderRadius: "50%",
            border: `4px dashed ${LINE}`,
            color: SOFT,
            fontSize: layout.sealFont / 2,
            fontWeight: 700,
          }}
        >
          {isCurrentWeek ? `あと${duty.total - duty.done}` : "来週"}
        </div>
      )}
    </div>
  );
}

/** 入りきらなかった Duty。未達を隠さないよう、まとめた分の済んだ数も出す */
function RestRow({ rest, layout }: { rest: ShareCardDuty[]; layout: RowLayout }) {
  const done = rest.reduce((sum, duty) => sum + duty.done, 0);
  const total = rest.reduce((sum, duty) => sum + duty.total, 0);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: `${layout.padding + 6}px 0 0`,
        fontSize: layout.sub,
        color: SOFT,
      }}
    >
      ほか {rest.length}件 · {done}/{total}
    </div>
  );
}

/** 要素の中の文字をすべて集める（Google Fonts から取るサブセットの字） */
function collectText(node: ReactNode, out: Set<string>): void {
  if (node === null || node === undefined || typeof node === "boolean") return;
  if (typeof node === "string" || typeof node === "number") {
    for (const char of String(node)) out.add(char);
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    if (typeof node.type === "function") {
      // 関数コンポーネントは展開して中の文字を拾う（lucide のアイコンは文字を持たない）
      collectText((node.type as (props: unknown) => ReactNode)(node.props), out);
    } else {
      collectText(node.props.children, out);
    }
  }
}

export async function renderShareImage(card: ShareCard, seed: string): Promise<ImageResponse> {
  const element = <ShareImage card={card} seed={seed} />;
  const chars = new Set<string>();
  collectText(element, chars);
  return new ImageResponse(element, {
    ...SHARE_IMAGE_SIZE,
    fonts: await loadShareFonts([...chars].join("")),
    headers: {
      // トークンごとに画像は変わらない（シェアし直すとトークンが変わる）
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
