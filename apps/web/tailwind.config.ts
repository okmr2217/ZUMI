import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        // アプリ本体（/app）の配色。画面モック（docs/04-screens.md 冒頭の Design canvas）のトークン
        zumi: {
          bg: "#FAF6EF",
          card: "#FFFFFF",
          ink: "#2B2620",
          // 小さい文字でも WCAG AA（4.5:1）に届くよう、モックの #8A8072 から明度だけ下げている。
          // 生成り地（bg）5.1:1・白地（card）5.5:1・pill 地 4.6:1
          soft: "#70685C",
          line: "#E7DFCE",
          shu: "#C8402A",
          "shu-deep": "#9C2E1C",
          base: "#F4EEE0",
          tint: "#FDF3EF",
          pill: "#F0ECE0",
          // 今日タブの「そろそろ」（モックの --warn / --warn-bg）
          warn: "#B07A2E",
          "warn-bg": "#F3E6CE",
          // 振り返りタブ（モックの朱の淡色・前週差分のチップ）
          "shu-bg": "#F7DFD8",
          success: "#5D7A49",
          "success-bg": "#E4ECDD",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        // 書体は app/fonts.ts の next/font が CSS 変数で渡す
        zumi: ["var(--font-zen-kaku)", "sans-serif"],
        // 「済」の朱印
        seal: ["var(--font-yuji-syuku)", "serif"],
      },
      keyframes: {
        // 今日タブの押印（モックにはアニメーションがないため、朱印が上から押される程度に留める）
        stamp: {
          "0%": { opacity: "0", transform: "scale(1.6) rotate(-8deg)" },
          "60%": { opacity: "1", transform: "scale(0.94) rotate(-8deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(-8deg)" },
        },
        // PC で中央に出すシート（components/app/responsive-sheet.tsx）。中央寄せの translate を含めて動かす
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "sheet-in": {
          from: { opacity: "0", transform: "translate(-50%, -50%) scale(.96)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "sheet-out": {
          from: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          to: { opacity: "0", transform: "translate(-50%, -50%) scale(.96)" },
        },
      },
      animation: {
        stamp: "stamp 260ms cubic-bezier(.2,.8,.3,1) both",
        "fade-in": "fade-in 180ms ease-out",
        "fade-out": "fade-out 150ms ease-in",
        "sheet-in": "sheet-in 200ms cubic-bezier(.2,.8,.3,1)",
        "sheet-out": "sheet-out 150ms ease-in",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [
    plugin(({ addVariant }) => {
      // iOS のホーム画面アプリだけ（-webkit-touch-callout は iOS の WebKit だけが解する）。
      // ビューポートの下端がホームインジケーターの上で切れるのに safe-area-inset-bottom が残る不具合の補正に使う
      addVariant(
        "ios-standalone",
        "@supports (-webkit-touch-callout: none) { @media (display-mode: standalone) { & } }",
      );
    }),
  ],
} satisfies Config;
