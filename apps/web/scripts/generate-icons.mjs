// PWA・ファビコン用のアイコン PNG を生成する。出力は静的ファイルとしてコミットし、
// Workers 上では生成せず配信だけを行う（フォントの base64 を Worker に追加で抱えないため）。
//
//   node scripts/generate-icons.mjs   （apps/web で実行）
//
// デザインは LP・OGP と同じ「済」の朱印（生成り地に朱の丸枠、Yuji Syuku、わずかに傾ける）。
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAPER = "#faf6ef";
const VERMILLION = "#c8402a";

// opengraph-image と同じサブセット済みフォントを使う（「済」を含む）
const fontSource = await readFile(join(root, "app/_og-fonts/data.ts"), "utf8");
const yujiB64 = fontSource.match(/YUJI_SYUKU_B64\s*=\s*"([^"]+)"/)?.[1];
if (!yujiB64) throw new Error("YUJI_SYUKU_B64 が app/_og-fonts/data.ts に見つからない");
const yuji = Buffer.from(yujiB64, "base64");

/**
 * @param {number} size     出力サイズ（正方形）
 * @param {number} seal     朱印の直径（size に対する比率）
 * @param {boolean} paper   生成り地で塗りつぶすか（false なら透過）
 */
function sealIcon(size, seal, paper) {
  const d = Math.round(size * seal);
  const border = Math.max(2, Math.round(d * 0.075));
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: paper ? PAPER : "transparent",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          width: d,
          height: d,
          borderRadius: "50%",
          border: `${border}px solid ${VERMILLION}`,
          color: VERMILLION,
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Yuji Syuku",
          fontSize: Math.round(d * 0.56),
          // 字形の重心が上に寄るため、わずかに下げて視覚的な中心に合わせる
          paddingTop: Math.round(d * 0.04),
          transform: "rotate(-8deg)",
        },
      },
      "済",
    ),
  );
}

async function render(size, seal, paper) {
  const res = new ImageResponse(sealIcon(size, seal, paper), {
    width: size,
    height: size,
    fonts: [{ name: "Yuji Syuku", data: yuji, weight: 400, style: "normal" }],
  });
  return Buffer.from(await res.arrayBuffer());
}

/** PNG を埋め込んだ ICO を組み立てる（Vista 以降の形式） */
function toIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

async function out(path, data) {
  const file = join(root, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, data);
  console.log(`${path} (${data.length} bytes)`);
}

// purpose: any … 地を全面に敷き、朱印は大きめ
await out("public/icons/icon-192.png", await render(192, 0.72, true));
await out("public/icons/icon-512.png", await render(512, 0.72, true));
// purpose: maskable … 円形にマスクされても欠けないよう、セーフゾーン（直径80%）の内側に収める
await out("public/icons/icon-maskable-512.png", await render(512, 0.56, true));
// iOS のホーム画面。角丸は OS が付けるので全面塗り
await out("app/apple-icon.png", await render(180, 0.7, true));
// タブのファビコン。小さいサイズでは地を透過し、朱印をいっぱいに描く
await out(
  "app/favicon.ico",
  toIco([
    { size: 16, data: await render(16, 0.94, false) },
    { size: 32, data: await render(32, 0.94, false) },
    { size: 48, data: await render(48, 0.94, false) },
  ]),
);
