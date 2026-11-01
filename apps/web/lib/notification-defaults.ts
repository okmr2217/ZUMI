/**
 * 時刻が未設定のまま ON にしたときの初期値（オンボーディングの初期値と同じ。docs/03）。
 * 設定フォーム（Client Component）からも使うため、DB を触るモジュールとは分けている。
 */
export const DEFAULT_MORNING_AT = "07:30";
export const DEFAULT_EVENING_AT = "22:00";
