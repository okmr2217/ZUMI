/**
 * Web Push の送信（VAPID: RFC 8292、ペイロード暗号化: RFC 8291 / aes128gcm: RFC 8188）。
 *
 * npm の `web-push` は送信に Node の `https.request` を使い、Workers では動かない
 * （暗号化も Node の crypto ポリフィル頼みになる）。そのため Web Crypto と `fetch` だけで実装する。
 * Web Crypto は Workers と Node の両方にあるため、同じコードを vitest で検証できる。
 */

export interface PushSubscriptionTarget {
  endpoint: string;
  /** 購読側の公開鍵（P-256 非圧縮 65 バイト）の base64url */
  p256dh: string;
  /** 購読側の認証シークレット（16 バイト）の base64url */
  auth: string;
}

/** VAPID 鍵。`web-push generate-vapid-keys` と同じ base64url 形式 */
export interface VapidKeys {
  /** P-256 非圧縮公開鍵（65 バイト） */
  publicKey: string;
  /** P-256 秘密鍵（32 バイト） */
  privateKey: string;
  /** 連絡先（`mailto:` か `https:` の URL） */
  subject: string;
}

export interface PushOptions {
  /** プッシュサービスが配信を待つ秒数。過ぎたら破棄される */
  ttl: number;
  urgency?: "very-low" | "low" | "normal" | "high";
  /** 同じ topic の未配信メッセージを置き換える（32 文字以内の base64url 文字） */
  topic?: string;
}

const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** P-256 の非圧縮公開鍵（0x04 || x || y）と秘密鍵 d から JWK を作る */
function toPrivateJwk(publicKey: Uint8Array, privateKey: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04 || privateKey.length !== 32) {
    throw new Error("P-256 の鍵の形式が不正です");
  }
  return {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
    d: base64UrlEncode(privateKey),
    ext: true,
  };
}

/** ECDH 用の鍵ペア。`publicKey` は非圧縮形式の生バイト */
export interface EcdhKeyPair {
  privateKey: CryptoKey;
  publicKey: Uint8Array;
}

async function generateEcdhKeyPair(): Promise<EcdhKeyPair> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const publicKey = new Uint8Array(
    (await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer,
  );
  return { privateKey: pair.privateKey, publicKey };
}

/** 生バイトの鍵ペアから ECDH 用の鍵ペアを作る（テストで RFC 8291 の固定値を使うため） */
export async function importEcdhKeyPair(
  publicKey: Uint8Array,
  privateKey: Uint8Array,
): Promise<EcdhKeyPair> {
  const key = await crypto.subtle.importKey(
    "jwk",
    toPrivateJwk(publicKey, privateKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  return { privateKey: key, publicKey };
}

/** aes128gcm のレコードサイズ。ペイロードは1レコードに収める */
const RECORD_SIZE = 4096;
/** 暗号化後のヘッダー（86 バイト）とタグ（16 バイト）・区切り（1 バイト）を引いた、平文の上限 */
export const MAX_PLAINTEXT_LENGTH = RECORD_SIZE - 86 - 16 - 1;

export interface EncryptOptions {
  /** テスト用。省略時はランダム */
  salt?: Uint8Array;
  /** テスト用。送信側の一時鍵。省略時は毎回生成する */
  localKeyPair?: EcdhKeyPair;
}

/** RFC 8291 に従ってペイロードを暗号化し、aes128gcm のボディ（ヘッダー + 1レコード）を返す */
export async function encryptPayload(
  plaintext: Uint8Array,
  subscription: Pick<PushSubscriptionTarget, "p256dh" | "auth">,
  options: EncryptOptions = {},
): Promise<Uint8Array> {
  if (plaintext.length > MAX_PLAINTEXT_LENGTH) {
    throw new Error(`ペイロードが大きすぎます（${plaintext.length} バイト）`);
  }
  const uaPublic = base64UrlDecode(subscription.p256dh);
  const authSecret = base64UrlDecode(subscription.auth);
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const local = options.localKeyPair ?? (await generateEcdhKeyPair());

  const uaKey = await crypto.subtle.importKey(
    "raw",
    uaPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  // workers-types は `public` を `$public` と型付けしているが、実行時の名前は標準どおり `public`
  const ecdhParams = { name: "ECDH", public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(ecdhParams, local.privateKey, 256),
  );

  const keyInfo = concat(encoder.encode("WebPush: info\0"), uaPublic, local.publicKey);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 最後のレコードなので区切りは 0x02（パディングなし）
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      concat(plaintext, new Uint8Array([0x02])),
    ),
  );

  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = local.publicKey.length;
  return concat(header, local.publicKey, ciphertext);
}

/** VAPID の署名鍵。1回の Cron で使い回す */
export interface VapidSigner {
  publicKey: string;
  subject: string;
  key: CryptoKey;
}

export async function createVapidSigner(keys: VapidKeys): Promise<VapidSigner> {
  const key = await crypto.subtle.importKey(
    "jwk",
    toPrivateJwk(base64UrlDecode(keys.publicKey), base64UrlDecode(keys.privateKey)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  return { publicKey: keys.publicKey, subject: keys.subject, key };
}

/** VAPID の JWT の有効期間。RFC 8292 の上限は 24 時間 */
const VAPID_EXPIRATION_SECONDS = 12 * 60 * 60;

/** `Authorization: vapid t=..., k=...` の値 */
export async function createVapidAuthorization(
  signer: VapidSigner,
  endpoint: string,
  now: Date,
): Promise<string> {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now.getTime() / 1000) + VAPID_EXPIRATION_SECONDS,
        sub: signer.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  // Web Crypto の ECDSA 署名は r || s（64 バイト）で、JWS の ES256 の形式と同じ
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signer.key,
      encoder.encode(unsigned),
    ),
  );
  return `vapid t=${unsigned}.${base64UrlEncode(signature)}, k=${signer.publicKey}`;
}

export interface PushRequest {
  endpoint: string;
  headers: Record<string, string>;
  body: Uint8Array;
}

/** 購読1件ぶんの送信リクエストを組み立てる */
export async function buildPushRequest(
  subscription: PushSubscriptionTarget,
  payload: string,
  signer: VapidSigner,
  options: PushOptions,
  now: Date,
): Promise<PushRequest> {
  const body = await encryptPayload(encoder.encode(payload), subscription);
  const headers: Record<string, string> = {
    Authorization: await createVapidAuthorization(signer, subscription.endpoint, now),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(options.ttl),
  };
  if (options.urgency) headers.Urgency = options.urgency;
  if (options.topic) headers.Topic = options.topic;
  return { endpoint: subscription.endpoint, headers, body };
}

export type PushResult =
  | { type: "SENT" }
  /** 購読が失効している（404 / 410）。購読を削除する */
  | { type: "GONE"; status: number }
  | { type: "FAILED"; status: number; detail: string };

export async function sendPush(
  subscription: PushSubscriptionTarget,
  payload: string,
  signer: VapidSigner,
  options: PushOptions,
  now: Date,
): Promise<PushResult> {
  const request = await buildPushRequest(subscription, payload, signer, options, now);
  const response = await fetch(request.endpoint, {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });
  if (response.ok) {
    // 本文は使わないが、接続を解放するために読み捨てる
    await response.body?.cancel();
    return { type: "SENT" };
  }
  if (response.status === 404 || response.status === 410) {
    await response.body?.cancel();
    return { type: "GONE", status: response.status };
  }
  return { type: "FAILED", status: response.status, detail: (await response.text()).slice(0, 500) };
}
