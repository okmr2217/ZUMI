import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * `/app` 配下を認証必須にする。DB アクセスを伴うセッション検証は行わず、
 * Cookie の有無のみを軽量にチェックする（実際の検証は各 Route/Server
 * Component 側で `auth.api.getSession` を使う）。
 */
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
