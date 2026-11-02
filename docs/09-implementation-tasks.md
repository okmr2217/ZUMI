# ZUMI（済） - MVP実装タスク一覧

> 関連: [Duty管理・記録・振り返り・アカウント](./03-duty-log-review-account.md) / [課金](./06-billing.md) / [実装優先順位](./07-roadmap.md)

## 9. MVP実装タスク一覧

`07-roadmap.md` のフェーズ構成を実装タスクレベルまで分解したもの。フェーズ0（基盤構築）・PWA対応・QA/リリース準備は `07-roadmap.md` の8フェーズには明記されていないが、実装上必須のため本ファイルで独立して洗い出す。

### フェーズ0: プロジェクト基盤構築 ✅ 完了

- [x] Turborepo モノレポ初期化（`package.json` workspaces, `turbo.json`）
- [x] `apps/web`（Next.js App Router + TypeScript）雛形作成
- [x] `apps/notify`（Cron Trigger Worker）雛形作成
- [x] `packages/db`（Drizzle スキーマ置き場）、`packages/types`（共有型）雛形作成
- [x] `@opennextjs/cloudflare` アダプタ導入、`wrangler.toml`（web/notify 双方）設定
- [x] Cloudflare D1 データベース作成、`database_id` を両 Worker の `wrangler.toml` に設定
- [x] Tailwind CSS + shadcn/ui セットアップ
- [x] ESLint / Prettier / TypeScript strict 設定、Turborepo 経由のスクリプト整備（lint/build/dev）
- [x] Sentry 初期設定（web/notify 双方。DSN・ソースマップアップロード用トークンまで設定済み）
- [x] CI（GitHub Actions）: lint/typecheck/build のパイプライン
- [x] CD（GitHub Actions）: `main` push / 手動実行で `zumi-web`・`zumi-notify` を Cloudflare Workers へ自動デプロイ
- [x] ローカル開発用 D1（`wrangler d1` ローカルモード）とシードスクリプトの動作確認（migration 0004 まで当てた新しいローカル D1 で実行確認済み。繰り返し実行できるよう、前回のシードユーザーを消してから入れ直す）

zumi-web（https://zumi.paritto.dev）・zumi-notify は本番 Cloudflare 環境に実デプロイ済み。詳細・残タスクは [OWNER-TASKS.md](./OWNER-TASKS.md) を参照。

### フェーズ1: 認証 + DBスキーマ ✅ 完了

better-auth の実設定（メール+パスワード、メール認証必須、パスワードリセット、
退会確認メール）を確定し、`npx @better-auth/cli generate` の出力を
`packages/db/src/auth-schema.ts` に反映、`drizzle-kit generate` で
マイグレーション（`0001_curly_puma.sql`）を生成してローカル D1 へ適用済み。

- [x] `packages/db/schema.ts`: `userSettings` / `pushSubscriptions` / `duties` / `logs` テーブル定義
- [x] better-auth 導入、Drizzle アダプタ設定（`user`/`session`/`account`/`verification`）
- [x] `drizzle-kit generate` → `wrangler d1 migrations apply` のマイグレーションフロー確立（フェーズ2以降の本番適用は指揮役セッションが行う。CLAUDE.md の「セッション運用」参照）
- [x] メール+パスワードのサインアップ/ログイン/ログアウト API・画面
- [x] メール認証（サインアップ時の確認メール送信・未認証時の利用制限）
- [x] パスワードリセット（リセットメール送信 → トークン検証 → 再設定画面）
- [x] 認証系メール送信基盤（Resend。`apps/web/lib/email.ts`）
- [x] 退会機能（アカウント削除、関連データのカスケード削除確認。確認メール経由）
- [x] 認証ミドルウェア（`/app` 配下の保護。`apps/web/proxy.ts`。Next.js 16 で middleware から改名）
- [x] 利用規約・プライバシーポリシーへの同意チェックボックス（サインアップ時。`/terms` `/privacy` は本文未確定のプレースホルダー）

### フェーズ2: Duty タブ（CRUD）

2026/11 に確定した仕様（テンプレート・アイコン・境界ルール・スキーマ変更）は [03](./03-duty-log-review-account.md) と [05](./05-tech-stack.md) を参照。

- [x] スキーマ変更のマイグレーション: `user_settings` に `weekStart`・`onboardedAt` を追加、`weeklySummaryWeekday` を削除、`duties.archivedAt` を追加、`duty_pauses` を新設
- [x] サインアップ時に `user_settings` の行を作成（better-auth `databaseHooks`）。アプリを開いたときにブラウザのタイムゾーンで更新
- [x] `ScheduleConfig` 型（`packages/types`）と6種のバリデーション（zod等）。`NTH_WEEK` は `every` = 2 固定、`MONTHLY` の `nth` は 1〜4 と -1（最終）
- [x] Duty 作成/編集/一時停止/アーカイブ API（一時停止・再開で `duty_pauses` を開閉、アーカイブで `archivedAt` を記録）
- [x] プリセットアイコン（lucide から16〜24個）とテンプレート10件の定数定義（`packages/types`）
- [x] Duty 一覧画面（カード表示、作成順、`sortOrder` は保持するがDnD UIはv1.1へ）
- [x] Duty 追加シート（Duty タブ・テンプレート画面・オンボーディングで共通の部品）。上部に「テンプレートから作成する」リンク
- [x] テンプレート画面（通常の作成用。オンボーディングと同じレイアウト。カードをタップすると内容が入った追加シートが開く）
- [x] 編集フォーム: 名前・アイコン・繰り返しタイプ6種の設定UI・前夜通知トグル・メモ欄有無
- [x] Duty 上限のチェックロジック（MVP中は10件。ACTIVE と PAUSED を数える。上限に達したら「アーカイブすると枠が空きます」と案内し、決済への誘導は行わない）

### フェーズ3: 今日タブ（期日計算ロジック）※実装上の山場

- [x] `packages/types` に6タイプ分の純粋関数を実装（`isDueToday` / 催促判定 / 週の残回数 など）。[期日計算の境界ルール](./03-duty-log-review-account.md#期日計算の境界ルール202611-確定) に従う
- [x] 上記ロジックのユニットテスト（境界値: 週またぎ、週の始まり 月/日、月末丸め、最終◯曜日、隔週アンカー、`SINCE_LAST` の初回、週の途中で作った `WEEKLY_COUNT`、一時停止期間）
- [x] 今日タブ画面: 3セクション（今日／そろそろ／今週）+ 進捗バー（X/Y）
- [x] 今日タブ上部の通知許可バナー（未許可のときだけ表示）
- [x] ワンタップ押印（空円タップ→即DONE、モーダルなし）の API・楽観的UI更新
- [x] 長押し詳細モーダル（対象日変更・スキップ・メモ）
- [x] 完了済み折りたたみ（「済んだもの N件」）
- [x] `(dutyId, targetDate)` ユニーク制約を用いた冪等な記録処理

### フェーズ4: 通知

- [x] Service Worker（`apps/web/public/sw.js`）: push イベント受信・通知表示
- [x] Web Push 購読フロー（VAPID鍵生成、許可ボタン、`pushSubscriptions`保存）
- [x] `apps/notify` Cron Trigger（毎分実行）: タイムゾーン+通知時刻でユーザー抽出
- [x] 朝の日次まとめ通知（対象ゼロなら送らない。文面は [通知の文面](./02-notifications.md#通知の文面)）
- [x] 締め切りアラート（夜・未完了Duty）
- [x] 週次サマリー通知（週の最終日に、設定した時刻で送る）
- [x] 期日不確定型の通知組み込み判定をフェーズ3の共有ロジックで実装（web/notify不整合防止。`WEEKLY_COUNT` は残回数 ≥ 残り日数）
- [x] 通知設定UI（許可ボタン、朝/夜/週次のON/OFF・時刻、タイムゾーン）

**LINE Messaging API連携はこのフェーズ・MVPには含めない。** Pro プランの目玉機能として
課金連携（v1.1以降、[06-billing.md](./06-billing.md) 参照）とあわせて実装する。MVPでは
Web Push のみで通知を成立させる。

### フェーズ5: 振り返りタブ

- [x] 週次サマリー集計API（達成率算出）
- [x] 週次サマリーカードUI
- [x] 履歴リスト（日付グループ、アイコン・名前・DONE/SKIPバッジ・メモ、無限スクロール）
- [x] 無料プラン履歴3ヶ月制限のクエリ・UI制御
- [ ] （月次カレンダーヒートマップはMVP対象外）

### フェーズ6: シェア画像生成（獲得導線のため優先度高）

- [x] `next/og`（Satori）で `/og/w/:token` エンドポイント（フォント埋め込みは LP の OGP 画像の実装 `apps/web/app/opengraph-image.tsx` を流用）
- [x] シェア用トークン発行・週次データ埋め込みロジック
- [x] シェア画像テンプレート（標準テーマ、プリセットアイコンのみ）
- [x] 振り返りタブからのシェア導線（Web Share API / 画像ダウンロード）

### フェーズ7: 設定モーダル・オンボーディング

- [x] 設定モーダル: アカウント（パスワード変更・退会。メールアドレス変更はMVP対象外）
- [x] 設定モーダル: 通知設定
- [x] 設定モーダル: データ（エクスポートはMVP対象外）
- [x] 設定モーダル: 表示（週の始まり 月/日）
- [x] 設定モーダル: ヘルプ（繰り返し設定の説明）
- [x] オンボーディングフロー（[03](./03-duty-log-review-account.md#オンボーディング202611-再設計)）: やることを選ぶ（1件ずつ追加シートで確定）→ 通知の時刻・週の始まり → ホーム画面に追加（iOS Safari のみ）→ 通知の許可。全ステップ飛ばせる
- [x] `onboardedAt` が null のとき `/app` からオンボーディングへリダイレクト

### フェーズ8: LP

**フェーズ1（認証+DBスキーマ）完了後に着手可能。** アプリ本体（フェーズ2〜7）には依存しないため、並行して進めてよい。

- [x] `docs/08-lp-draft.md` を基にLPコンテンツ確定（デザインcanvasのコピーで確定。`docs/04-screens.md` 冒頭リンク先と同様に [LPデザインcanvas](https://claude.ai/code/artifact/3baa3ec2-9ca5-4111-968c-297453f86e5d) を参照）
- [x] LP実装（カスタムCSS、ルート`/`に配置、`/app`と単一ドメイン共存）— `apps/web/app/page.tsx` + `apps/web/app/lp.css`（`.zumi-lp` スコープで shadcn/Tailwind と分離）
- [x] LPからサインアップ導線（CTAは `/app` へリンク。フェーズ1でサインアップ画面が実装され次第、実URLに差し替える）

### 横断: PWA対応

- [x] `manifest.json`（アイコン、テーマカラー、`display: standalone`）
- [ ] Service Worker のキャッシュ戦略（最小限のオフライン対応）
- [x] iOS「ホーム画面に追加」導線UI（iOS Web Push制約の案内。オンボーディングのステップ3と共通）
- [x] iOS のスタンドアロン起動用 meta（`appleWebApp` と `apple-mobile-web-app-capable`。clipnote の `apps/web/src/app/layout.tsx` と同じ対応）、manifest のアイコン
- [ ] Lighthouse PWA監査・インストール可能性の確認

### 横断: 公開前のサインアップ制限（早めに対応）

本番ではすでに LP からサインアップできる状態のため、公開するまで閉じておく（[05](./05-tech-stack.md#ドメイン構成)）。

- [x] 環境変数（例: `SIGNUP_ENABLED`）でサインアップ画面と API を閉じる
- [x] 閉じている間は、LP の CTA に準備中であることを表示する

### 横断: 法務ドキュメント

作成は実装完了後、公開前に行う（取得データ・外部送信先が実装で確定してから書くため）。それまでは上記のサインアップ制限で、本文のない規約への同意を発生させない。

- [x] 利用規約の作成
- [x] プライバシーポリシーの作成（取得データ、Sentryへの送信データの扱い等）
- [ ] 特定商取引法に基づく表記（課金開始前に必要。MVP時点では省略可）
- [x] LP・サインアップ画面・フッターへの規約/ポリシーへの導線設置

### 横断: QA・リリース準備

- [ ] E2Eテスト（主要フロー: サインアップ→Duty作成→押印→通知→シェア）
- [ ] 本番D1・Cron Trigger・カスタムドメイン（`zumi.paritto.dev`）の疎通確認
- [ ] Cloudflare Workers デプロイパイプライン整備
- [ ] リポジトリ全体に prettier（tailwind プラグイン込み）を一括でかけ、CI に `format:check` を足す（並行の作業セッションが落ち着いてから。途中でかけると各ブランチと衝突するため）
- [x] シェア画像の仕上げ（[03](./03-duty-log-review-account.md#シェア画像の設計方針) の「シェア画像の運用」）: `/og/w/:token` を `caches.default` でキャッシュする。`share_tokens.card` を読み込み時に zod で検証し、合わない行は 404 にする
- [ ] 実機（iOS Safari・ホーム画面アプリ・Android Chrome）での確認: シェアの共有シートとダウンロードへの切り替え、Web Push の受信と通知タップからの遷移、ログアウト時の購読解除
- [x] LP の safe-area 対応: `viewport-fit=cover` により、横向きのノッチ付き iPhone で LP の左右の余白がノッチにわずかに重なる。`lp.css` の `.wrap` に `env(safe-area-inset-*)` の余白を足す

## 課金（MVP対象外・v1.1以降）

MVP時点では**無料プランの制約ロジックのみ実装し、課金導線・決済連携は持たない**。課金機能が追加されるまでは、全ユーザーが無料プランの制約（MVP中は Duty10件・履歴3ヶ月等）のもとで利用する（Pro向けの解放や決済誘導は行わない）。詳細は [06-billing.md](./06-billing.md) を参照。

決済連携が必要になった段階でのタスク（参考）:

- [ ] Stripe等の決済プロバイダ選定・連携
- [ ] Pro プラン管理（プラン種別カラム追加、Webhook処理での状態同期）
- [ ] Pro限定機能のフラグ制御（無制限Duty、履歴無制限、LINE通知、シェアテーマ、共有Duty）
- [ ] 課金設定UI（アップグレード導線、プラン管理画面、解約フロー）

## v1.1以降で追加する機能（参考・再掲）

`07-roadmap.md` に記載の後回し機能。着手時期の判断材料として理由込みで再掲する。

| 機能 | 後回しの理由 |
|---|---|
| Duty の DnD 並び替え | MVP中は Duty10件までなので作成順表示で当面代替可（DBの`sortOrder`列自体はMVPから保持） |
| 月次カレンダーヒートマップ | 獲得ループの本体は週次サマリー＋シェア画像で、ヒートマップは補助機能 |
| 通知のメールフォールバック | まずWeb Pushのみで配信し、iOS制約の影響を見てから判断 |
| 前夜通知（Duty単位） | 朝夜の基本2通が安定してから個別オプトインとして追加 |
| データエクスポート（JSON/CSV） | 初期ユーザー数を踏まえ優先度を下げる |
| メールアドレス変更 | 退会機能は維持するが変更系は後回し |
| 課金（Stripe連携・Proプラン制御） | MVPは無料プラン制約ロジックのみとし、決済連携自体を後回しにする |
| 通知の送信記録（夏時間・Cron の取りこぼし対策） | 夏時間のある地域では、時刻が重なる日に2回送り、飛ぶ日には届かない。Cron が起動しなかった分もさかのぼって送らない。直すには送信記録のテーブルが要る。`Asia/Tokyo` には影響しないため後回し（2026/11 判断） |
