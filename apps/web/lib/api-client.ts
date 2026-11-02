/** アプリの API の呼び出し（ブラウザ側）。失敗時はエラーコードを返し、文言は画面側で決める */
export type ApiResult = { ok: true } | { ok: false; error: string };

/**
 * JSON を送り、成否だけを返す。失敗時は応答の `{ error }` を、読めなければ "unknown" を返す。
 * 通信自体に失敗したときは "network"。リトライはしない
 */
export async function sendJson(
  url: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data: unknown = await res.json().catch(() => null);
    const error =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : "unknown";
    return { ok: false, error };
  } catch {
    return { ok: false, error: "network" };
  }
}
