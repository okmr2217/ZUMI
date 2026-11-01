import {
  AirVent,
  Banknote,
  Bath,
  BedDouble,
  BookOpen,
  Brush,
  Circle,
  CupSoda,
  Dog,
  Dumbbell,
  Footprints,
  HeartPulse,
  Moon,
  PenLine,
  Phone,
  Pill,
  Recycle,
  Shirt,
  ShieldCheck,
  ShowerHead,
  Sparkles,
  Sprout,
  Trash2,
  Utensils,
  WashingMachine,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { PresetIconName } from "@zumi/types";

/**
 * プリセットアイコン名 → lucide のコンポーネント。`Record<PresetIconName, …>` にして、
 * `PRESET_ICONS` に足したアイコンの描画漏れを型で検出する。
 */
const ICONS: Record<PresetIconName, LucideIcon> = {
  "trash-2": Trash2,
  recycle: Recycle,
  bath: Bath,
  "shower-head": ShowerHead,
  "bed-double": BedDouble,
  brush: Brush,
  sparkles: Sparkles,
  "washing-machine": WashingMachine,
  shirt: Shirt,
  "air-vent": AirVent,
  "cup-soda": CupSoda,
  pill: Pill,
  utensils: Utensils,
  dumbbell: Dumbbell,
  footprints: Footprints,
  "heart-pulse": HeartPulse,
  moon: Moon,
  "book-open": BookOpen,
  "pen-line": PenLine,
  phone: Phone,
  banknote: Banknote,
  "shield-check": ShieldCheck,
  sprout: Sprout,
  dog: Dog,
};

/** Duty のアイコン。一覧から外した名前が DB に残っていても落ちないよう、未知の名前は円で描く */
export function DutyIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = Object.hasOwn(ICONS, name) ? ICONS[name as PresetIconName] : Circle;
  return <Icon aria-hidden {...props} />;
}
