import type { Page, Request } from "@playwright/test";
import { expect, test } from "./fixtures";
import {
  DIRECT_URL,
  clickUntilVisible,
  clientIpHeaders,
  expectProgress,
  logIn,
  signUp,
  tab,
  uniqueEmail,
  verifyEmail,
} from "./helpers";

/**
 * 主要フロー（docs/09: サインアップ → Duty 作成 → 押印 → 振り返り → シェア → 通知設定）を、
 * 1人のユーザーで順に通す。前のステップの状態（作った Duty・押した記録）を次で使うため直列に流す。
 *
 * 日付はサーバー・ブラウザとも実際の今日のまま（固定しない）。数は「今日の分」「今週の分」の
 * 相対的なものだけを確かめ、曜日や月に左右される値（週の対象日数など）は見ない。
 */
test.describe.configure({ mode: "serial" });

let page: Page;
let email: string;

test.beforeAll(async ({ browser }) => {
  // 失敗して直列のテストを最初からやり直すとき（CI の retries）も、別のユーザーで始める
  email = uniqueEmail("main");
  // 直列のテストで使い回すコンテキストは fixture の外で作るため、送信元 IP をここで決める
  const context = await browser.newContext({ extraHTTPHeaders: clientIpHeaders() });
  // シェアで実際の共有シートを開かないよう、Web Share API を差し替えて渡されたファイルを控える
  await context.addInitScript(() => {
    const shared: { name: string; type: string; size: number }[] = [];
    Object.defineProperty(window, "__sharedFiles", { value: shared });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data?: ShareData) => !!data?.files?.length,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data?: ShareData) => {
        for (const file of data?.files ?? []) {
          shared.push({ name: file.name, type: file.type, size: file.size });
        }
      },
    });
  });
  page = await context.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

test("サインアップし、メールを確認してログインする", async ({ request }) => {
  await signUp(page, email);

  // 確認前はログインできない
  await logIn(page, email);
  await expect(page.getByText("メールアドレスが未確認です。")).toBeVisible();

  await verifyEmail(request, email);
  // ログイン後の遷移はソフト遷移の1回だけで、ドキュメントを読み直さない
  // （以前は better-auth の callbackURL によるハード遷移が重なり、オンボーディングが2回読み込まれていた）
  const documents: string[] = [];
  const timezonePosts: string[] = [];
  const track = (req: Request) => {
    // ログイン画面そのものの読み込みは数えない
    if (req.resourceType() === "document" && new URL(req.url()).pathname !== "/login") {
      documents.push(req.url());
    }
    if (req.method() === "POST" && req.url().endsWith("/api/settings/timezone")) {
      timezonePosts.push(req.url());
    }
  };
  page.on("request", track);
  await logIn(page, email);
  // 初回はオンボーディングへ送られる
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: /やることを/ })).toBeVisible();
  await expect.poll(() => timezonePosts.length).toBe(1);
  // 2回目の読み込みが遅れて来ないことも見る（ソフト遷移のあとは networkidle を待っても待たずに返る）
  await page.waitForTimeout(1500);
  page.off("request", track);
  expect(documents).toEqual([]);
  expect(timezonePosts).toHaveLength(1);
});

test("オンボーディングでテンプレートから Duty を1件作る", async () => {
  await expect(page.getByRole("heading", { name: /やることを/ })).toBeVisible();
  // 「お風呂」は SINCE_LAST（前回から2日）のテンプレート
  const sheet = page.getByRole("dialog", { name: "Dutyを追加" });
  await clickUntilVisible(page.getByRole("button", { name: /^お風呂/ }), sheet);
  await expect(sheet.getByLabel("名前")).toHaveValue("お風呂");
  await expect(sheet.getByRole("radio", { name: "前回から◯日空いたら" })).toBeChecked();
  await sheet.getByRole("button", { name: "追加する" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: "次へ（1件）" }).click();

  // 通知の時刻は初期値のまま保存する
  await expect(page.getByRole("heading", { name: /お知らせする時刻/ })).toBeVisible();
  await page.getByRole("button", { name: "次へ", exact: true }).click();

  // 通知の許可は飛ばす（ブラウザの対応状況で、ボタンが「あとで」か「はじめる」になる）
  await expect(page.getByRole("heading", { name: /通知をオンに/ })).toBeVisible();
  await page.getByRole("button", { name: /^(あとで|はじめる)$/ }).click();

  await expect(page).toHaveURL(/\/app$/);
  // SINCE_LAST は、まだ済ませていなければ作成直後から「そろそろ」に出る（docs/03）
  await expect(page.getByRole("heading", { name: "そろそろ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "お風呂を済にする" })).toBeVisible();
  await expectProgress(page, 0, 1);
});

async function openCreateSheet() {
  await page.getByRole("button", { name: "追加", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Dutyを追加" });
  await expect(sheet).toBeVisible();
  return sheet;
}

function dutyCard(name: string) {
  return page.getByRole("main").getByRole("button", { name: new RegExp(`^${name}`) });
}

test("Duty タブで DAILY と SINCE_LAST の Duty を作り、編集する", async () => {
  await tab(page, "Duty").click();
  await expect(page.getByRole("heading", { name: "Duty", exact: true })).toBeVisible();
  await expect(dutyCard("お風呂")).toContainText("前回から2日空いたら");

  // DAILY（繰り返しの初期値は「毎日やる」）
  let sheet = await openCreateSheet();
  await sheet.getByLabel("名前").fill("ストレッチ");
  await expect(sheet.getByRole("radio", { name: "毎日やる" })).toBeChecked();
  await sheet.getByRole("button", { name: "追加する" }).click();
  await expect(sheet).toBeHidden();
  await expect(dutyCard("ストレッチ")).toContainText("毎日");

  // SINCE_LAST（初期値の3日から1日増やして4日）
  sheet = await openCreateSheet();
  await sheet.getByLabel("名前").fill("換気扇の掃除");
  await sheet.getByRole("radio", { name: "前回から◯日空いたら" }).click();
  await expect(sheet.getByText("前回から 3 日空いたら")).toBeVisible();
  await sheet.getByRole("button", { name: "増やす" }).click();
  await sheet.getByRole("button", { name: "追加する" }).click();
  await expect(sheet).toBeHidden();
  await expect(dutyCard("換気扇の掃除")).toContainText("前回から4日空いたら");

  // 編集: DAILY の名前を変える
  await dutyCard("ストレッチ").click();
  let edit = page.getByRole("dialog", { name: "Dutyを編集" });
  await edit.getByLabel("名前").fill("朝のストレッチ");
  await edit.getByRole("button", { name: "保存する" }).click();
  await expect(edit).toBeHidden();
  await expect(dutyCard("朝のストレッチ")).toContainText("毎日");

  // 編集: SINCE_LAST の日数を変える
  await dutyCard("換気扇の掃除").click();
  edit = page.getByRole("dialog", { name: "Dutyを編集" });
  await expect(edit.getByText("前回から 4 日空いたら")).toBeVisible();
  await edit.getByRole("button", { name: "減らす" }).click();
  await edit.getByRole("button", { name: "保存する" }).click();
  await expect(edit).toBeHidden();
  await expect(dutyCard("換気扇の掃除")).toContainText("前回から3日空いたら");

  // 読み込み直しても残っている
  await page.reload();
  await expect(dutyCard("朝のストレッチ")).toContainText("毎日");
  await expect(dutyCard("換気扇の掃除")).toContainText("前回から3日空いたら");
  await expect(dutyCard("お風呂")).toContainText("前回から2日空いたら");
});

/** 押印・取り消しのリクエストが返るまで待つ（楽観的な表示だけで先に進まないため） */
function logRequest(method: "PUT" | "DELETE") {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method && /\/api\/duties\/[^/]+\/logs\//.test(response.url()),
  );
}

test("今日タブで「済」を押すと進捗が増え、取り消せる", async () => {
  await tab(page, "今日").click();
  await expect(page.getByRole("heading", { level: 1, name: "今日", exact: true })).toBeVisible();
  // DAILY は「今日」、SINCE_LAST の2件は「そろそろ」
  await expect(page.getByRole("button", { name: "朝のストレッチを済にする" })).toBeVisible();
  await expectProgress(page, 0, 3);

  let saved = logRequest("PUT");
  await page.getByRole("button", { name: "朝のストレッチを済にする" }).click();
  expect((await saved).ok()).toBe(true);
  await expectProgress(page, 1, 3);

  const removed = logRequest("DELETE");
  await page.getByRole("button", { name: "朝のストレッチの「済」を取り消す" }).click();
  expect((await removed).ok()).toBe(true);
  await expectProgress(page, 0, 3);

  // 取り消しがサーバーに残っている
  await page.reload();
  await expectProgress(page, 0, 3);
  await expect(page.getByRole("button", { name: "朝のストレッチを済にする" })).toBeVisible();

  // 振り返りで使うため、もう一度押しておく
  saved = logRequest("PUT");
  await page.getByRole("button", { name: "朝のストレッチを済にする" }).click();
  expect((await saved).ok()).toBe(true);
  await expectProgress(page, 1, 3);

  // 読み込み直すと「済んだもの」に入る
  await page.reload();
  await expectProgress(page, 1, 3);
  await page.getByRole("button", { name: "済んだもの 1件" }).click();
  await expect(
    page.getByRole("button", { name: "朝のストレッチの「済」を取り消す" }),
  ).toBeVisible();
});

test("振り返りタブに今週の達成が出る", async () => {
  await tab(page, "振り返り").click();
  const summary = page.getByRole("region", { name: "週次サマリー" });
  await expect(summary).toBeVisible();

  // 今週の DAILY は今日の1回が済。SINCE_LAST は今日の催促が未済で 0/1
  await expect(summary.getByRole("listitem").filter({ hasText: "朝のストレッチ" })).toContainText(
    /毎日 · 1\/\d+/,
  );
  await expect(summary.getByRole("listitem").filter({ hasText: "お風呂" })).toContainText(
    "前回から2日空いたら · 0/1",
  );
  await expect(summary.getByRole("listitem").filter({ hasText: "換気扇の掃除" })).toContainText(
    "前回から3日空いたら · 0/1",
  );

  // 履歴に今日の記録が1件出る（絞り込みのボタンにも同じ名前が出るため、記録の行の方を見る）
  const history = page.getByRole("region", { name: "履歴" });
  await expect(
    history.getByText("朝のストレッチ", { exact: true }).and(page.locator("span")),
  ).toHaveCount(1);
  await expect(history.getByText("済", { exact: true })).toHaveCount(1);
});

test("シェアボタンでトークンが発行され、PNG を共有に渡す", async ({ request }) => {
  const issued = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/api/review/share"),
  );
  const image = page.waitForResponse((response) => /\/og\/w\/[^/?]+$/.test(response.url()));
  await page.getByRole("button", { name: "週次サマリーを画像で共有" }).click();

  const issuedResponse = await issued;
  expect(issuedResponse.status()).toBe(201);
  const { token, imageUrl } = (await issuedResponse.json()) as { token: string; imageUrl: string };
  expect(token).toBeTruthy();
  expect(imageUrl).toBe(`/og/w/${token}`);

  const imageResponse = await image;
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toBe("image/png");
  // ブラウザが読んだ本文は Playwright から取れない（ストリームで返るため）。中身は下の未ログインの取得で確かめる

  // 差し替えた navigator.share に PNG のファイルが渡っている
  await expect(page.getByRole("button", { name: "週次サマリーを画像で共有" })).toBeEnabled();
  const shared = await page.evaluate(
    () =>
      (window as unknown as { __sharedFiles: { name: string; type: string; size: number }[] })
        .__sharedFiles,
  );
  expect(shared).toHaveLength(1);
  expect(shared[0]).toMatchObject({
    type: "image/png",
    name: expect.stringMatching(/^zumi-\d{4}-\d{2}-\d{2}\.png$/),
  });
  expect(shared[0]!.size).toBeGreaterThan(1000);

  // 画像の URL はログインしていなくても開ける（シェア先で表示するため）
  const anonymous = await request.get(`${DIRECT_URL}${imageUrl}`);
  expect(anonymous.status()).toBe(200);
  expect(anonymous.headers()["content-type"]).toBe("image/png");
  expectPng(await anonymous.body());

  // 知らないトークンは 404
  const unknown = await request.get(`${DIRECT_URL}/og/w/${"x".repeat(token.length)}`);
  expect(unknown.status()).toBe(404);
});

function expectPng(body: Buffer) {
  expect(body.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
}

/** 通知設定の保存（PATCH）が返るまで待つ */
function settingsSaved() {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith("/api/settings/notifications"),
  );
}

test("通知設定を変えると保存される", async () => {
  await tab(page, "今日").click();
  await page.getByRole("link", { name: "設定" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();

  // オンボーディングで初期値のまま保存したので、朝・夜とも ON
  const morning = settings.getByRole("switch", { name: "朝の通知" });
  await expect(morning).toHaveAttribute("aria-checked", "true");

  let saved = settingsSaved();
  await morning.click();
  expect((await saved).ok()).toBe(true);
  await expect(morning).toHaveAttribute("aria-checked", "false");
  await expect(settings.getByLabel("朝の通知の時刻")).toBeDisabled();

  // 時刻はフォーカスを外したときに保存する
  saved = settingsSaved();
  const evening = settings.getByLabel("夜の通知の時刻");
  await evening.fill("21:30");
  // 別の場所をタップしてフォーカスを外す
  await settings.getByRole("heading", { name: "通知", exact: true }).click();
  expect((await saved).ok()).toBe(true);

  // 設定ページとして開き直しても残っている
  await page.goto("/app/settings");
  await expect(page.getByRole("switch", { name: "朝の通知" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.getByRole("switch", { name: "夜の通知" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByLabel("夜の通知の時刻")).toHaveValue("21:30");
});
