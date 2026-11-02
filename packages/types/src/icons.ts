import { z } from "zod";

/**
 * Duty のプリセットアイコン。値は lucide のアイコン名（kebab-case）で、DB の
 * `duties.icon` にそのまま保存する。Web アプリでもシェア画像（Satori）でも同じ SVG を
 * 描画するため、絵文字は使わない（docs/03-duty-log-review-account.md「属性」）。
 *
 * 一覧から外したアイコンも既存 Duty の `icon` には残りうるため、表示側は
 * 未知の名前でも落ちないようにすること。
 */
export const PRESET_ICONS = [
  { name: "trash-2", label: "ゴミ箱" },
  { name: "recycle", label: "リサイクル" },
  { name: "bath", label: "お風呂" },
  { name: "shower-head", label: "シャワー" },
  { name: "bed-double", label: "ベッド" },
  { name: "brush", label: "ブラシ" },
  { name: "sparkles", label: "きらきら" },
  { name: "washing-machine", label: "洗濯機" },
  { name: "shirt", label: "シャツ" },
  { name: "air-vent", label: "エアコン" },
  { name: "cup-soda", label: "カップ" },
  { name: "pill", label: "薬" },
  { name: "utensils", label: "食事" },
  { name: "dumbbell", label: "ダンベル" },
  { name: "footprints", label: "散歩" },
  { name: "heart-pulse", label: "健康" },
  { name: "moon", label: "睡眠" },
  { name: "book-open", label: "本" },
  { name: "pen-line", label: "ペン" },
  { name: "phone", label: "電話" },
  { name: "banknote", label: "お金" },
  { name: "shield-check", label: "点検" },
  { name: "sprout", label: "植物" },
  { name: "dog", label: "ペット" },
] as const;

export type PresetIconName = (typeof PRESET_ICONS)[number]["name"];

export const PRESET_ICON_NAMES = PRESET_ICONS.map((icon) => icon.name) as [
  PresetIconName,
  ...PresetIconName[],
];

/** Duty の作成・編集時に `icon` を検証する */
export const presetIconNameSchema = z.enum(PRESET_ICON_NAMES);
