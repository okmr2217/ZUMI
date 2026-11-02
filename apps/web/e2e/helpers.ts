import { randomInt, randomUUID } from "node:crypto";
import { signJWT } from "better-auth/crypto";
import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { E2E_AUTH_SECRET, E2E_PORT } from "./config.mjs";

/** Node から直接たたくときの URL（Node は `*.localhost` を名前解決できないことがある） */
export const DIRECT_URL = `http://127.0.0.1:${E2E_PORT}`;

export const PASSWORD = "e2e-password-123";

/**
 * ブラウザ・API のコンテキストごとに別の送信元 IP を名乗るヘッダー。
 *
 * better-auth はサインアップ・ログインを同じ IP から 10 秒に 3 回までに制限している。E2E の
 * リクエストはすべて 127.0.0.1 から届くため、テストが続くと上限に当たる。本番の制限はそのままにして、
 * テストのユーザーごとに別のクライアントとして扱わせる。better-auth が IP を読むヘッダー
 * （`X-Forwarded-For`）と、Cloudflare が付けるヘッダー（`CF-Connecting-IP`。wrangler dev は
 * 送られてきた値をそのまま通す）の両方に入れる。
 */
export function clientIpHeaders(): Record<string, string> {
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  return { "X-Forwarded-For": ip, "CF-Connecting-IP": ip };
}

/** 実行ごと・テストごとに重ならないメールアドレス（D1 を使い回したときも衝突しない） */
export function uniqueEmail(label: string) {
  return `e2e-${label}-${randomUUID().slice(0, 8)}@example.com`;
}

/**
 * 確認メールのリンクのトークン。better-auth の `createEmailVerificationToken` と同じく、
 * `{ email }` を BETTER_AUTH_SECRET で署名した JWT にする。E2E では確認メールを送れないため
 * （RESEND_API_KEY が空）、メールを受け取る代わりにここで作ったリンクを開く。
 */
export function emailVerificationToken(email: string) {
  return signJWT({ email: email.toLowerCase() }, E2E_AUTH_SECRET, 3600);
}

/**
 * 確認メールのリンクを開いた扱いにする。ブラウザとは別の Cookie で開くので、
 * ブラウザ側は未ログインのまま（このあとログイン画面からログインする）。
 */
export async function verifyEmail(request: APIRequestContext, email: string) {
  const token = await emailVerificationToken(email);
  const response = await request.get(
    `${DIRECT_URL}/api/auth/verify-email?token=${token}&callbackURL=%2Flogin`,
    { maxRedirects: 0 },
  );
  expect(response.status(), await response.text()).toBe(302);
}

/**
 * ページを開き、React のハイドレーションが済むまで待つ。済む前に押すと、ボタンは空振りし、
 * フォームはブラウザ既定の送信（GET）になってしまう。
 */
export async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => {
    const button = document.querySelector("main button, form button");
    return !!button && Object.keys(button).some((key) => key.startsWith("__reactFiber$"));
  });
}

/** サインアップ画面から登録し、確認待ちの画面まで進める */
export async function signUp(page: Page, email: string) {
  await gotoHydrated(page, "/signup");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "登録する" }).click();
  // パスワードのハッシュ計算は重く、並列で走らせると1つの Worker に詰まって10秒を超えることがある
  await expect(page.getByRole("heading", { name: "メールアドレスを確認してください" })).toBeVisible(
    {
      timeout: 30_000,
    },
  );
}

export async function logIn(page: Page, email: string) {
  await gotoHydrated(page, "/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
}

/** サインアップ → メール確認 → ログインまで（オンボーディングの手前） */
export async function signUpAndLogIn(page: Page, request: APIRequestContext, label: string) {
  const email = uniqueEmail(label);
  await signUp(page, email);
  await verifyEmail(request, email);
  await logIn(page, email);
  await expect(page).toHaveURL(/\/onboarding$/);
  return email;
}

/** 下部タブ */
export function tab(page: Page, name: "今日" | "振り返り" | "Duty") {
  return page.getByRole("navigation").getByRole("link", { name, exact: true });
}

/** 今日タブの進捗バー。aria-valuenow が済んだ数、aria-valuemax が対象の数 */
export async function expectProgress(page: Page, done: number, total: number) {
  const bar = page.getByRole("progressbar", { name: "今日の進捗" });
  await expect(bar).toHaveAttribute("aria-valuenow", String(done));
  await expect(bar).toHaveAttribute("aria-valuemax", String(total));
  await expect(page.getByText(`${done} / ${total}`, { exact: true })).toBeVisible();
}

/**
 * `target` を押して `opened` が出るまで繰り返す。ログイン直後は `/onboarding` がもう一度
 * ドキュメントごと読み込まれ、ハイドレーション前のクリックが空振りすることがあるため。
 */
export async function clickUntilVisible(target: Locator, opened: Locator) {
  await expect(async () => {
    if (!(await opened.isVisible())) await target.click();
    await expect(opened).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
