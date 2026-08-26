import { ImageResponse } from "next/og";
import { ZKG_400_B64, ZKG_700_B64, ZKG_900_B64, YUJI_SYUKU_B64 } from "./_og-fonts/data";

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export const alt = "ZUMI（済） — 定期的な「やらなきゃ」を、可視化しよう。";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#2b2620";
const INK_SOFT = "#8a8072";
const PAPER = "#faf6ef";
const PAPER_SUNKEN = "#f4eee0";
const LINE = "#e7dfce";
const VERMILLION = "#c8402a";
const WARN = "#b07a2e";
const WARN_BG = "#f3e6ce";

function IconChevronLeft() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
      <path d="M15 6l-6 6 6 6" stroke={INK_SOFT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke={INK_SOFT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke={INK_SOFT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke={INK_SOFT} strokeWidth={1.6} />
      <path
        d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        stroke={INK_SOFT}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12"
        stroke={INK}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconProtein() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="16" height="7" rx="3.5" transform="rotate(-30 12 13)" stroke={INK} strokeWidth={1.6} />
      <path d="M9 8.5l6 9" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function IconBath() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 12h16v2a5 5 0 01-5 5H9a5 5 0 01-5-5v-2z" stroke={INK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 12V6a2 2 0 012-2h1" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke={PAPER} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavCircle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "#ffffff",
        border: `1px solid ${LINE}`,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

function DutyRow({
  icon,
  name,
  sub,
  warnBadge,
  stamped,
}: {
  icon: React.ReactNode;
  name: string;
  sub?: string;
  warnBadge?: string;
  stamped?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        background: "#ffffff",
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        padding: "12px 13px",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 35,
          height: 35,
          borderRadius: 10,
          background: PAPER_SUNKEN,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 2 }}>
        <div style={{ display: "flex", fontSize: 13, fontWeight: 700, color: INK }}>{name}</div>
        {sub ? <div style={{ display: "flex", fontSize: 10, color: INK_SOFT }}>{sub}</div> : null}
        {warnBadge ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "2px 8px",
              borderRadius: 17,
              background: WARN_BG,
              color: WARN,
              fontSize: 9,
              fontWeight: 700,
              alignSelf: "flex-start",
            }}
          >
            {warnBadge}
          </div>
        ) : null}
      </div>
      {stamped ? (
        <div
          style={{
            display: "flex",
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: `2px solid ${VERMILLION}`,
            color: VERMILLION,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontFamily: "Yuji Syuku",
            transform: "rotate(-8deg)",
            flexShrink: 0,
          }}
        >
          済
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: `2px solid ${LINE}`,
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}

function TabItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 9 }}>
      <div
        style={{
          display: "flex",
          width: 18,
          height: 18,
          borderRadius: 5,
          background: active ? VERMILLION : "transparent",
          border: active ? "none" : "2px solid #c6bca9",
        }}
      />
      <div style={{ display: "flex", color: active ? VERMILLION : INK_SOFT, fontWeight: active ? 700 : 400 }}>{label}</div>
    </div>
  );
}

export default async function Image() {
  const zkg400 = base64ToArrayBuffer(ZKG_400_B64);
  const zkg700 = base64ToArrayBuffer(ZKG_700_B64);
  const zkg900 = base64ToArrayBuffer(ZKG_900_B64);
  const yuji = base64ToArrayBuffer(YUJI_SYUKU_B64);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: PAPER,
          fontFamily: "Zen Kaku Gothic New",
          color: INK,
          overflow: "hidden",
        }}
      >
        {/* left: copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "54%",
            padding: "53px 0 53px 62px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div
              style={{
                display: "flex",
                width: 43,
                height: 43,
                borderRadius: "50%",
                border: `3px solid ${VERMILLION}`,
                color: VERMILLION,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontFamily: "Yuji Syuku",
                transform: "rotate(-6deg)",
              }}
            >
              済
            </div>
            <div style={{ display: "flex", fontSize: 20, fontWeight: 900, letterSpacing: 6, color: INK }}>ZUMI</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 43, fontWeight: 900, lineHeight: 1.38 }}>
              <span>定期的な「やらなきゃ」を、</span>
              <span>可視化しよう。</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 18,
                fontSize: 16,
                color: "#5c5346",
                lineHeight: 1.85,
              }}
            >
              <span>毎日のことも、月イチのことも。</span>
              <span>同じ場所で、押すだけ。</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: VERMILLION,
              color: PAPER,
              alignSelf: "flex-start",
              padding: "14px 26px",
              borderRadius: 99,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            無料で始める
            <IconArrowRight />
          </div>
        </div>

        {/* right: phone mock of 今日 tab (Main.dc.html に準拠) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            right: 50,
            top: -21,
            width: 366,
            height: 672,
            background: "#ede7d8",
            borderRadius: 38,
            border: `1px solid ${LINE}`,
            boxShadow: "0 29px 53px rgba(30,26,20,0.28)",
            transform: "rotate(3deg)",
            overflow: "hidden",
          }}
        >
          {/* topbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 23px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <NavCircle>
                <IconChevronLeft />
              </NavCircle>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", fontSize: 11, color: INK_SOFT }}>8月24日（月）</div>
                <div style={{ display: "flex", fontSize: 20, fontWeight: 700, marginTop: 1 }}>今日</div>
              </div>
              <NavCircle>
                <IconChevronRight />
              </NavCircle>
            </div>
            <div
              style={{
                display: "flex",
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#ffffff",
                border: `1px solid ${LINE}`,
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginLeft: 12,
              }}
            >
              <IconGear />
            </div>
          </div>

          {/* progress */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "18px 23px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: INK_SOFT }}>
              <span>今日の進捗</span>
              <span>3 / 5</span>
            </div>
            <div style={{ display: "flex", height: 6, borderRadius: 5, background: LINE, overflow: "hidden" }}>
              <div style={{ display: "flex", height: "100%", width: "60%", background: VERMILLION, borderRadius: 5 }} />
            </div>
          </div>

          {/* scroll body */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 20, padding: "20px 23px 0" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 10, fontWeight: 700, color: INK_SOFT, letterSpacing: 1, marginBottom: 10 }}>
                今日
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <DutyRow icon={<IconTrash />} name="ゴミ出し（可燃）" sub="火・金" />
                <DutyRow icon={<IconProtein />} name="プロテイン摂取" sub="毎日" stamped />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 10, fontWeight: 700, color: WARN, letterSpacing: 1, marginBottom: 10 }}>
                そろそろ
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <DutyRow icon={<IconBath />} name="お風呂" warnBadge="最後から2日" />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 1px", color: INK_SOFT, fontSize: 10 }}>
              <span>済んだもの 2件</span>
              <IconChevronDown />
            </div>
          </div>

          {/* tabbar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              background: "#ffffff",
              borderTop: `1px solid ${LINE}`,
              padding: "13px 0 18px",
              flexShrink: 0,
            }}
          >
            <TabItem label="今日" active />
            <TabItem label="振り返り" />
            <TabItem label="Duty" />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Zen Kaku Gothic New", data: zkg400, weight: 400, style: "normal" },
        { name: "Zen Kaku Gothic New", data: zkg700, weight: 700, style: "normal" },
        { name: "Zen Kaku Gothic New", data: zkg900, weight: 900, style: "normal" },
        { name: "Yuji Syuku", data: yuji, weight: 400, style: "normal" },
      ],
    },
  );
}
