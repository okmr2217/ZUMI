import { describe, expect, it } from "vitest";
import {
  MAX_PLAINTEXT_LENGTH,
  base64UrlDecode,
  base64UrlEncode,
  buildPushRequest,
  createVapidAuthorization,
  createVapidSigner,
  encryptPayload,
  importEcdhKeyPair,
} from "./webpush";

const encoder = new TextEncoder();

// RFC 8291 Appendix A の固定値
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPublic:
    "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic:
    "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8),
  );
}

/** 受信側（ブラウザ）の復号。暗号化の実装とは独立に RFC 8291 を書き下したもの */
async function decrypt(
  body: Uint8Array,
  uaPublic: Uint8Array,
  uaPrivate: CryptoKey,
  auth: Uint8Array,
) {
  const salt = body.slice(0, 16);
  const idLength = body[20]!;
  const asPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  const asKey = await crypto.subtle.importKey(
    "raw",
    asPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: asKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      uaPrivate,
      256,
    ),
  );
  const info = new Uint8Array([...encoder.encode("WebPush: info\0"), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, secret, info, 32);
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext),
  );
  expect(padded[padded.length - 1]).toBe(0x02);
  return new TextDecoder().decode(padded.slice(0, -1));
}

async function generateSubscriptionKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const publicKey = new Uint8Array(
    (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer,
  );
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return {
    privateKey: pair.privateKey,
    publicKey,
    auth,
    subscription: {
      endpoint: "https://push.example.com/send/abc123",
      p256dh: base64UrlEncode(publicKey),
      auth: base64UrlEncode(auth),
    },
  };
}

async function generateVapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const publicRaw = new Uint8Array(
    (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer,
  );
  return {
    verifyKey: pair.publicKey,
    keys: {
      publicKey: base64UrlEncode(publicRaw),
      privateKey: jwk.d!,
      subject: "https://zumi.paritto.dev",
    },
  };
}

describe("base64url", () => {
  it("往復で元に戻る（パディングなし）", () => {
    for (const length of [0, 1, 2, 3, 16, 65]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 255) % 256);
      const encoded = base64UrlEncode(bytes);
      expect(encoded).not.toMatch(/[+/=]/);
      expect(base64UrlDecode(encoded)).toEqual(bytes);
    }
  });
});

describe("encryptPayload", () => {
  it("RFC 8291 Appendix A のテストベクタと一致する", async () => {
    const body = await encryptPayload(
      encoder.encode(RFC.plaintext),
      { p256dh: RFC.uaPublic, auth: RFC.auth },
      {
        salt: base64UrlDecode(RFC.salt),
        localKeyPair: await importEcdhKeyPair(
          base64UrlDecode(RFC.asPublic),
          base64UrlDecode(RFC.asPrivate),
        ),
      },
    );
    expect(base64UrlEncode(body)).toBe(RFC.body);
  });

  it("受信側の鍵で復号できる（毎回ランダムな salt・一時鍵）", async () => {
    const ua = await generateSubscriptionKeys();
    const payload = JSON.stringify({
      title: "今日の Duty 3件",
      body: "ゴミ出し・お風呂（そろそろ）",
    });
    const first = await encryptPayload(encoder.encode(payload), ua.subscription);
    const second = await encryptPayload(encoder.encode(payload), ua.subscription);
    expect(first).not.toEqual(second);
    expect(await decrypt(first, ua.publicKey, ua.privateKey, ua.auth)).toBe(payload);
    expect(await decrypt(second, ua.publicKey, ua.privateKey, ua.auth)).toBe(payload);
  });

  it("1レコードに収まらないペイロードは拒否する", async () => {
    const ua = await generateSubscriptionKeys();
    await expect(
      encryptPayload(new Uint8Array(MAX_PLAINTEXT_LENGTH + 1), ua.subscription),
    ).rejects.toThrow();
    await expect(
      encryptPayload(new Uint8Array(MAX_PLAINTEXT_LENGTH), ua.subscription),
    ).resolves.toHaveLength(4096);
  });
});

describe("createVapidAuthorization", () => {
  it("aud・exp・sub を持つ ES256 の JWT を、公開鍵で検証できる形で返す", async () => {
    const { keys, verifyKey } = await generateVapidKeys();
    const signer = await createVapidSigner(keys);
    const now = new Date("2026-11-02T12:00:00Z");
    const value = await createVapidAuthorization(
      signer,
      "https://fcm.googleapis.com/fcm/send/xyz",
      now,
    );

    const match = /^vapid t=([^,]+), k=(.+)$/.exec(value);
    expect(match).not.toBeNull();
    const [, jwt, k] = match!;
    expect(k).toBe(keys.publicKey);

    const [header, claims, signature] = jwt!.split(".") as [string, string, string];
    const decode = (part: string) => JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
    expect(decode(header)).toEqual({ typ: "JWT", alg: "ES256" });
    expect(decode(claims)).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: now.getTime() / 1000 + 12 * 60 * 60,
      sub: "https://zumi.paritto.dev",
    });
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      verifyKey,
      base64UrlDecode(signature),
      encoder.encode(`${header}.${claims}`),
    );
    expect(valid).toBe(true);
  });

  it("鍵の形式が不正なら例外", async () => {
    const { keys } = await generateVapidKeys();
    await expect(createVapidSigner({ ...keys, publicKey: "AAAA" })).rejects.toThrow();
  });
});

describe("buildPushRequest", () => {
  it("暗号化ボディと Web Push のヘッダーを組み立てる", async () => {
    const ua = await generateSubscriptionKeys();
    const { keys } = await generateVapidKeys();
    const signer = await createVapidSigner(keys);
    const request = await buildPushRequest(
      ua.subscription,
      '{"title":"t"}',
      signer,
      { ttl: 3600, urgency: "normal", topic: "zumi-morning" },
      new Date("2026-11-02T12:00:00Z"),
    );
    expect(request.endpoint).toBe(ua.subscription.endpoint);
    expect(request.headers).toMatchObject({
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "normal",
      Topic: "zumi-morning",
    });
    expect(request.headers.Authorization).toMatch(/^vapid t=.+, k=/);
    expect(await decrypt(request.body, ua.publicKey, ua.privateKey, ua.auth)).toBe('{"title":"t"}');
  });
});
