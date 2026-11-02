import { YUJI_SYUKU_B64, ZKG_400_B64, ZKG_700_B64 } from "@/app/_og-fonts/data";

/**
 * `next/og`（Satori）に渡すフォント。LP の OGP 画像（app/opengraph-image.tsx）と同じく、
 * Workers では実ファイルを読めないため base64 で埋め込んだものを使う。
 *
 * 埋め込みのフォントは LP の文字だけのサブセットで、ユーザーが付けた Duty 名は描けない。
 * そのためシェア画像では、画像に出す文字だけを Google Fonts から取り寄せる（`text=` で必要な字だけのサブセット）。
 * 取れなかったときは埋め込みのフォントで描く（足りない字は欠けるが、画像自体は返す）。
 */

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700;
  style: "normal";
};

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const GOTHIC = "Zen Kaku Gothic New";
export const SEAL_FONT = "Yuji Syuku";

/** Google Fonts が応答しないときに、画像のリクエストごと待たせないための上限 */
const FONT_FETCH_TIMEOUT_MS = 4000;

/** Google Fonts から `text` の字だけを含む TrueType を取る。失敗したら null */
async function fetchGoogleFont(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const signal = AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS);
    const params = new URLSearchParams({
      family: `${GOTHIC}:wght@${weight}`,
      text,
    });
    // User-Agent を付けないと TrueType の URL が返る（Satori は woff2 を読めない）
    const css = await fetch(`https://fonts.googleapis.com/css2?${params}`, { signal }).then(
      (res) => (res.ok ? res.text() : ""),
    );
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { signal });
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * `text` を描くためのフォント（本文 400 / 500 / 700 と朱印の Yuji Syuku）。
 * `complete` は Google Fonts から全部取れたか（false なら埋め込みで代えていて、字が欠けうる）
 */
export async function loadShareFonts(
  text: string,
): Promise<{ fonts: OgFont[]; complete: boolean }> {
  const [regular, medium, bold] = await Promise.all(
    [400, 500, 700].map((weight) => fetchGoogleFont(weight, text)),
  );
  const fonts: OgFont[] = [
    {
      name: GOTHIC,
      data: regular ?? base64ToArrayBuffer(ZKG_400_B64),
      weight: 400,
      style: "normal",
    },
    // 埋め込みには 500 がないので、取れなかったときは 400 で代える
    {
      name: GOTHIC,
      data: medium ?? base64ToArrayBuffer(ZKG_400_B64),
      weight: 500,
      style: "normal",
    },
    { name: GOTHIC, data: bold ?? base64ToArrayBuffer(ZKG_700_B64), weight: 700, style: "normal" },
    // 朱印の「済」は埋め込みのサブセットに入っている
    { name: SEAL_FONT, data: base64ToArrayBuffer(YUJI_SYUKU_B64), weight: 400, style: "normal" },
  ];
  return { fonts, complete: Boolean(regular && medium && bold) };
}
