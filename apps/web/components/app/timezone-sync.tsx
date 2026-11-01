"use client";

import { useEffect } from "react";

/**
 * 設定画面でタイムゾーンを手で選んだ端末に立てる印。立っている間は、
 * ブラウザのタイムゾーンで上書きしない。印は端末ごとなので、別の端末で
 * アプリを開くとその端末のブラウザの値で上書きされる。
 */
const MANUAL_TIMEZONE_KEY = "zumi:timezone-manual";

export function isTimezoneManual() {
  try {
    return localStorage.getItem(MANUAL_TIMEZONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTimezoneManual(manual: boolean) {
  try {
    if (manual) localStorage.setItem(MANUAL_TIMEZONE_KEY, "1");
    else localStorage.removeItem(MANUAL_TIMEZONE_KEY);
  } catch {
    // ストレージが使えない環境では、毎回ブラウザの値に戻るだけ。
  }
}

export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * `/app` を開いたときに、ブラウザのタイムゾーンをサーバーへ送る。
 * 変わっていなければサーバー側で書き込まないため、ページを開くたびに送ってよい。
 * 失敗しても画面の操作には影響しないので、エラーは握りつぶす。
 */
export function TimezoneSync() {
  useEffect(() => {
    if (isTimezoneManual()) return;
    const timezone = getBrowserTimezone();
    if (!timezone) return;

    fetch("/api/settings/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    }).catch(() => {});
  }, []);

  return null;
}
