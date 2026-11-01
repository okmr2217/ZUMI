import type { Config } from "tailwindcss";

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
          soft: "#8A8072",
          line: "#E7DFCE",
          shu: "#C8402A",
          "shu-deep": "#9C2E1C",
          base: "#F4EEE0",
          tint: "#FDF3EF",
          pill: "#F0ECE0",
          // 今日タブの「そろそろ」（モックの --warn / --warn-bg）
          warn: "#B07A2E",
          "warn-bg": "#F3E6CE",
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
        zumi: ['"Zen Kaku Gothic New"', '"Noto Sans JP"', "sans-serif"],
      },
      keyframes: {
        // 今日タブの押印（モックにはアニメーションがないため、朱印が上から押される程度に留める）
        stamp: {
          "0%": { opacity: "0", transform: "scale(1.6) rotate(-8deg)" },
          "60%": { opacity: "1", transform: "scale(0.94) rotate(-8deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(-8deg)" },
        },
      },
      animation: {
        stamp: "stamp 260ms cubic-bezier(.2,.8,.3,1) both",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
