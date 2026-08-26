function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html lang="ja">
  <body style="font-family: sans-serif; color: #1c1917; line-height: 1.6;">
    <h1 style="font-size: 18px;">${title}</h1>
    ${bodyHtml}
    <p style="color: #78716c; font-size: 12px; margin-top: 32px;">ZUMI（済）</p>
  </body>
</html>`;
}

export function verificationEmail(url: string) {
  return layout(
    "メールアドレスの確認",
    `<p>ZUMI（済）へのご登録ありがとうございます。以下のリンクからメールアドレスを確認してください。</p>
     <p><a href="${url}">${url}</a></p>
     <p>このリンクは1時間で有効期限が切れます。心当たりがない場合はこのメールを無視してください。</p>`,
  );
}

export function resetPasswordEmail(url: string) {
  return layout(
    "パスワードの再設定",
    `<p>パスワード再設定のリクエストを受け付けました。以下のリンクから新しいパスワードを設定してください。</p>
     <p><a href="${url}">${url}</a></p>
     <p>このリンクは1時間で有効期限が切れます。心当たりがない場合はこのメールを無視してください。</p>`,
  );
}

export function deleteAccountEmail(url: string) {
  return layout(
    "アカウント削除の確認",
    `<p>アカウント削除のリクエストを受け付けました。削除を完了するには以下のリンクを開いてください。</p>
     <p><a href="${url}">${url}</a></p>
     <p>Duty・記録などすべてのデータが完全に削除されます。この操作は取り消せません。心当たりがない場合はこのメールを無視してください。</p>`,
  );
}
