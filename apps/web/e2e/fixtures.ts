import { test as base } from "@playwright/test";
import { clientIpHeaders } from "./helpers";

/** テストごとに別の送信元 IP を名乗る（`clientIpHeaders` を参照）。`page`・`request` の両方に効く */
export const test = base.extend({
  // Playwright は第1引数の分割代入から依存する fixture を読むため、使わなくても `{}` と書く。
  // 第2引数は Playwright の値を渡す関数で、React の `use` とは別物
  // eslint-disable-next-line no-empty-pattern
  extraHTTPHeaders: async ({}, provide) => {
    await provide(clientIpHeaders());
  },
});

export { expect } from "@playwright/test";
