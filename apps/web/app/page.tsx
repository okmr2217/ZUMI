import { isSignupEnabled } from "@/lib/signup";
import { LandingPage } from "./landing";

// SIGNUP_ENABLED はリクエスト時の Cloudflare env から読むため、ビルド時に静的生成しない。
export const dynamic = "force-dynamic";

export default function Page() {
  return <LandingPage signupEnabled={isSignupEnabled()} />;
}
