"use client";

import { useEffect } from "react";

export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * `/app` を開いたときに、ブラウザのタイムゾーンをサーバーへ送る。
 * 変わっていないとき、設定画面で手で選んでいるときはサーバー側で書き込まないため、
 * ページを開くたびに送ってよい。
 * 失敗しても画面の操作には影響しないので、エラーは握りつぶす。
 */
export function TimezoneSync() {
  useEffect(() => {
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
