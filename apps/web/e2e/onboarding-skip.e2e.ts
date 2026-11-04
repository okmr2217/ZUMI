import { expect, test } from "./fixtures";
import { clickUntilVisible, signUpAndLogIn, tab } from "./helpers";

test("オンボーディングをすべて飛ばすと、空の今日タブに着き、以後はオンボーディングに戻らない", async ({
  page,
  request,
}) => {
  await signUpAndLogIn(page, request, "skip");

  const skipDuties = page.getByRole("button", { name: "あとで追加する" });
  await clickUntilVisible(page.getByRole("button", { name: /^(次へ|あとで)$/ }), skipDuties);
  const skipNotify = page.getByRole("button", { name: "あとで設定する" });
  await skipDuties.click();
  // 「あとで設定する」で onboardedAt が記録される（docs/03）
  await skipNotify.click();
  await page.getByRole("button", { name: /^(あとで|はじめる)$/ }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("まだ Duty がありません。")).toBeVisible();

  // 開き直してもオンボーディングへは送られない
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1, name: "今日", exact: true })).toBeVisible();

  await tab(page, "Duty").click();
  await expect(page.getByText("まだ Duty がありません。")).toBeVisible();
});
