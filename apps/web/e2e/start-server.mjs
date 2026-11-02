// E2E 用のサーバーを起動する（Playwright の `webServer` から呼ぶ）。
//
// 1. ローカル D1 を作り直す（開発用の `.wrangler/state` とは別のディレクトリ）
// 2. migration を当てる
// 3. `opennextjs-cloudflare build` で本番と同じ Worker をビルドする（`E2E_SKIP_BUILD=1` で省略）
// 4. `wrangler dev` で起動する
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { E2E_AUTH_SECRET, E2E_BASE_URL, E2E_HOST, E2E_PORT } from "./config.mjs";

const webDir = path.resolve(import.meta.dirname, "..");
const dbDir = path.resolve(webDir, "../../packages/db");
const persistDir = path.join(webDir, ".wrangler/e2e-state");

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(" ")} exited with ${code}`)),
    );
  });
}

rmSync(persistDir, { recursive: true, force: true });

await run(
  "npx",
  ["wrangler", "d1", "migrations", "apply", "zumi-db", "--local", "--persist-to", persistDir],
  { cwd: dbDir, env: { ...process.env, CI: "1" } },
);

if (process.env.E2E_SKIP_BUILD !== "1") {
  await run("npm", ["run", "cf:build"], {
    cwd: webDir,
    // Sentry のシークレットが無くてもビルドできるよう空にする（CI の build と同じ）
    env: {
      ...process.env,
      NEXT_PUBLIC_SENTRY_DSN: "",
      SENTRY_DSN: "",
      NEXT_PUBLIC_APP_ENV: "development",
    },
  });
}

const server = spawn(
  "npx",
  [
    "wrangler",
    "dev",
    "--config",
    "e2e/wrangler.e2e.toml",
    "--ip",
    "127.0.0.1",
    "--port",
    String(E2E_PORT),
    "--persist-to",
    persistDir,
    // wrangler は Host・Origin をこの値に書き換えて Worker に渡す。ブラウザで開く URL と
    // 合わせないと better-auth の Origin の検証（INVALID_ORIGIN）で落ちる
    "--local-upstream",
    `${E2E_HOST}:${E2E_PORT}`,
    "--var",
    `BETTER_AUTH_URL:${E2E_BASE_URL}`,
    "--var",
    `BETTER_AUTH_SECRET:${E2E_AUTH_SECRET}`,
    "--show-interactive-dev-session=false",
    // リクエストごとのログでテストの出力が埋もれないよう、警告以上だけを出す
    "--log-level",
    "warn",
  ],
  { cwd: webDir, stdio: "inherit" },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
