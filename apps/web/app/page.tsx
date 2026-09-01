"use client";

import { useEffect, useRef, useState } from "react";
import "./lp.css";
import {
  IconBath,
  IconBell,
  IconBook,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconFan,
  IconGear,
  IconHistory,
  IconLock,
  IconProtein,
  IconRead,
  IconSubscription,
  IconTabDaily,
  IconTabDuty,
  IconTabReview,
  IconTrash,
} from "./lp-icons";

// フェーズ8: LP。docs/08-lp-draft.md のコピーを、デザインcanvas
// （https://claude.ai/code/artifact/3baa3ec2-9ca5-4111-968c-297453f86e5d）のレイアウト・配色に沿って実装。
const SIGNUP_HREF = "/signup";

type DailyRowState = "done" | "empty" | "lock";

type DailyRow = {
  icon: "trash" | "protein" | "bath" | "book";
  name: string;
  sub: string;
  state: DailyRowState;
  warn?: boolean;
};

type DailyGroup = {
  label: string;
  warn?: boolean;
  rows: DailyRow[];
};

type DailyState = {
  date: string;
  title: string;
  pill: boolean;
  progressLabel: string;
  progressFrac: string;
  progressPct: number;
  groups: DailyGroup[];
  collapsed?: string;
  hint: string;
};

const DAILY_ICONS = { trash: IconTrash, protein: IconProtein, bath: IconBath, book: IconBook };

const DAILY_STATES: DailyState[] = [
  {
    date: "8月22日（土）",
    title: "過去の記録",
    pill: true,
    progressLabel: "この日の進捗",
    progressFrac: "2 / 3",
    progressPct: 67,
    groups: [
      {
        label: "この日の Duty",
        rows: [
          { icon: "trash", name: "ゴミ出し（可燃）", sub: "火・金", state: "done" },
          { icon: "protein", name: "プロテイン", sub: "毎日", state: "done" },
          { icon: "bath", name: "お風呂", sub: "未記録", state: "empty" },
        ],
      },
    ],
    hint: "タップして、この日の分を後から記録できます",
  },
  {
    date: "8月24日（月）",
    title: "今日",
    pill: false,
    progressLabel: "今日の進捗",
    progressFrac: "3 / 5",
    progressPct: 60,
    groups: [
      {
        label: "今日",
        rows: [
          { icon: "trash", name: "ゴミ出し（可燃）", sub: "火・金", state: "done" },
          { icon: "protein", name: "プロテイン", sub: "毎日", state: "empty" },
        ],
      },
      {
        label: "そろそろ",
        warn: true,
        rows: [{ icon: "bath", name: "お風呂", sub: "最後から2日", state: "empty", warn: true }],
      },
      {
        label: "今週",
        rows: [{ icon: "book", name: "英語学習", sub: "あと1回・日曜まで", state: "empty" }],
      },
    ],
    collapsed: "済んだもの 2件",
    hint: "",
  },
  {
    date: "8月26日（水）",
    title: "予定の確認",
    pill: true,
    progressLabel: "この日の予定",
    progressFrac: "0 / 2",
    progressPct: 0,
    groups: [
      {
        label: "この日の予定",
        rows: [
          { icon: "trash", name: "ゴミ出し（資源）", sub: "火・金", state: "lock" },
          { icon: "protein", name: "プロテイン", sub: "毎日", state: "lock" },
        ],
      },
    ],
    hint: "先の予定です。「済」にできるのは、その日になってから",
  },
];

function DailyRowView({ row }: { row: DailyRow }) {
  const Icon = DAILY_ICONS[row.icon];
  let control: React.ReactNode;
  if (row.state === "done") {
    control = <div className="hanko">済</div>;
  } else if (row.state === "lock") {
    control = (
      <div className="lock-badge">
        <IconLock />
      </div>
    );
  } else {
    control = <div className="tap-empty" />;
  }
  return (
    <div className={`app-row${row.state === "lock" ? " dim" : ""}`}>
      <div className="app-icon-badge">
        <Icon />
      </div>
      <div className="app-row-main">
        <div className="app-row-name">{row.name}</div>
        {row.warn ? <div className="badge-warn">{row.sub}</div> : <div className="app-row-sub">{row.sub}</div>}
      </div>
      {control}
    </div>
  );
}

function DailyDemo() {
  const [index, setIndex] = useState(1);
  const s = DAILY_STATES[index]!;

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <div className="app-datebar">
          <button
            className="app-navbtn"
            aria-label="前の日へ"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <IconChevronLeft />
          </button>
          <div className="app-datecenter">
            <div className="app-date">{s.date}</div>
            <div className="app-title">{s.title}</div>
          </div>
          <button
            className="app-navbtn"
            aria-label="次の日へ"
            disabled={index === DAILY_STATES.length - 1}
            onClick={() => setIndex((i) => Math.min(DAILY_STATES.length - 1, i + 1))}
          >
            <IconChevronRight />
          </button>
        </div>
        <div className="app-gear" aria-hidden="true">
          <IconGear />
        </div>
      </div>

      <button className={`app-pill${s.pill ? " visible" : ""}`} type="button" onClick={() => setIndex(1)}>
        <IconHistory />
        今日へ戻る
      </button>

      <div className="app-progress-row">
        <div className="app-progress-label">
          <span>{s.progressLabel}</span>
          <span>{s.progressFrac}</span>
        </div>
        <div className="app-progress-track">
          <div className="app-progress-fill" style={{ width: `${s.progressPct}%` }} />
        </div>
      </div>

      <div className="app-scroll">
        {s.groups.map((g) => (
          <div key={g.label}>
            <div className={`app-group-label${g.warn ? " warn" : ""}`}>{g.label}</div>
            <div className="app-cardlist">
              {g.rows.map((row) => (
                <DailyRowView key={row.name} row={row} />
              ))}
            </div>
          </div>
        ))}
        {s.collapsed && (
          <div className="app-collapsed">
            <span>{s.collapsed}</span>
            <IconChevronDown />
          </div>
        )}
      </div>
      <p className="app-hint">{s.hint}</p>
    </div>
  );
}

function HeroCard() {
  const [proteinDone, setProteinDone] = useState(false);

  return (
    <div className="app-shell reveal in">
      <div className="app-topbar">
        <div className="app-datebar">
          <div className="app-navbtn" aria-hidden="true">
            <IconChevronLeft />
          </div>
          <div className="app-datecenter">
            <div className="app-date">8月24日（月）</div>
            <div className="app-title">今日</div>
          </div>
          <div className="app-navbtn" aria-hidden="true">
            <IconChevronRight />
          </div>
        </div>
        <div className="app-gear" aria-hidden="true">
          <IconGear />
        </div>
      </div>

      <div className="app-progress-row">
        <div className="app-progress-label">
          <span>今日の進捗</span>
          <span>{proteinDone ? 4 : 3} / 5</span>
        </div>
        <div className="app-progress-track">
          <div className="app-progress-fill" style={{ width: proteinDone ? "80%" : "60%" }} />
        </div>
      </div>

      <div className="app-scroll">
        <div>
          <div className="app-group-label">今日</div>
          <div className="app-cardlist">
            <div className="app-row">
              <div className="app-icon-badge">
                <IconTrash />
              </div>
              <div className="app-row-main">
                <div className="app-row-name">ゴミ出し（可燃）</div>
                <div className="app-row-sub">火・金</div>
              </div>
              <div className="hanko" aria-hidden="true">
                済
              </div>
            </div>
            <div className="app-row">
              <div className="app-icon-badge">
                <IconProtein />
              </div>
              <div className="app-row-main">
                <div className="app-row-name">プロテイン</div>
                <div className="app-row-sub">毎日</div>
              </div>
              {proteinDone ? (
                <button className="hanko animate" aria-pressed="true" aria-label="プロテインは済みました" disabled>
                  済
                </button>
              ) : (
                <button
                  className="tap-empty"
                  aria-pressed="false"
                  aria-label="プロテインを済にする"
                  onClick={() => setProteinDone(true)}
                />
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="app-group-label warn">そろそろ</div>
          <div className="app-cardlist">
            <div className="app-row">
              <div className="app-icon-badge">
                <IconBath />
              </div>
              <div className="app-row-main">
                <div className="app-row-name">お風呂</div>
                <div className="badge-warn">最後から2日</div>
              </div>
              <div className="tap-empty" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div>
          <div className="app-group-label">今週</div>
          <div className="app-cardlist">
            <div className="app-row">
              <div className="app-icon-badge">
                <IconBook />
              </div>
              <div className="app-row-main">
                <div className="app-row-name">英語学習</div>
                <div className="app-row-sub">あと1回・日曜まで</div>
              </div>
              <div className="tap-empty" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="app-collapsed">
          <span>済んだもの 2件</span>
          <IconChevronDown />
        </div>
      </div>

      <div className="app-tabbar" aria-hidden="true">
        <div className="app-tab active">
          <IconTabDaily />
          デイリー
        </div>
        <div className="app-tab">
          <IconTabReview />
          振り返り
        </div>
        <div className="app-tab">
          <IconTabDuty />
          Duty
        </div>
      </div>
    </div>
  );
}

function useRevealOnScroll() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll(".reveal");
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return rootRef;
}

const DUTY_EXAMPLES = [
  { icon: IconTrash, name: "ゴミ出し（可燃）", sub: "火・金" },
  { icon: IconBath, name: "お風呂", sub: "前回から2日空いたら" },
  { icon: IconProtein, name: "プロテイン", sub: "毎日" },
  { icon: IconBook, name: "英語学習", sub: "週に2回" },
  { icon: IconRead, name: "シーツ交換", sub: "月に1回くらい" },
  { icon: IconClock, name: "水回り掃除", sub: "前回から◯日空いたら" },
  { icon: IconFan, name: "換気扇掃除", sub: "月イチくらいで十分" },
  { icon: IconSubscription, name: "サブスク見直し", sub: "月イチで棚卸し" },
  { icon: IconRead, name: "読書", sub: "月に1冊は読みたい" },
];

const HISTORY_GROUPS = [
  {
    date: "8月24日（月）",
    rows: [
      { icon: IconTrash, name: "ゴミ出し（可燃）", time: "7:42", badge: "done" as const },
      { icon: IconProtein, name: "プロテイン", time: "21:10", badge: "done" as const },
    ],
  },
  {
    date: "8月23日（日）",
    rows: [
      { icon: IconBath, name: "お風呂", time: "22:30", badge: "skip" as const },
      { icon: IconBook, name: "英語学習", time: "19:05", badge: "done" as const },
    ],
  },
  {
    date: "8月22日（土）",
    rows: [
      { icon: IconTrash, name: "ゴミ出し（資源）", time: "7:38", badge: "done" as const },
      { icon: IconProtein, name: "プロテイン", time: "20:52", badge: "done" as const },
    ],
  },
];

const HEAT_CELLS = [
  null, 4, 2, 3, 4, 1, 3, 4, 4, 3, null, 4, 5, 3, 4, 4, 5, 3, 4, 5, 4,
];

export default function LandingPage() {
  const rootRef = useRevealOnScroll();

  return (
    <div className="zumi-lp" ref={rootRef}>
      <div className="grain" />

      <header>
        <nav className="nav">
          <a className="wordmark" href="#top">
            <span className="seal-mini">済</span>
            ZUMI
          </a>
          <a className="btn btn-primary btn-small" href={SIGNUP_HREF}>
            無料ではじめる
          </a>
        </nav>
      </header>

      <main id="top">
        {/* HERO */}
        <div className="wrap">
          <section className="hero">
            <div>
              <span className="eyebrow">定期的な「やらなきゃ」の記録アプリ</span>
              <h1>
                定期的な
                <br />
                「やらなきゃ」を、
                <br />
                可視化しよう。
              </h1>
              <p className="sub">
                なりたい自分のためでも、やらなきゃいけないことでもいい。
                <br />
                毎日のことも、月イチのことも。同じ場所で、押すだけ。
              </p>
              <div className="cta-row">
                <a className="btn btn-primary" href={SIGNUP_HREF}>
                  無料ではじめる
                </a>
                <span className="hint">クレジットカード不要</span>
              </div>
            </div>

            <HeroCard />
          </section>
        </div>

        <div className="rule" />

        {/* どんな「やらなきゃ」を扱うのか + 期日パターン */}
        <div className="wrap">
          <section className="reveal">
            <span className="eyebrow">どんな「やらなきゃ」を扱うのか</span>
            <h2>
              なりたい自分のためでも、
              <br />
              すでにやらなきゃいけないことでもいい。
            </h2>
            <p className="body-text">
              大事なのは、それが定期的にやってくること。以下はDutyの例です。テンプレートから選ぶだけでも、自由入力で追加してもかまいません。
            </p>

            <div className="duty-grid">
              {DUTY_EXAMPLES.map((d) => (
                <div className="card duty-card" key={d.name}>
                  <div className="duty-icon">
                    <d.icon size={20} />
                  </div>
                  <div>
                    <div className="duty-name">{d.name}</div>
                    <div className="duty-sub">{d.sub}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="cat-note">毎日じゃなくていい活動も、ちゃんと拾えます。</p>

            <div className="subsection">
              <div className="subrule" />
              <span className="sub-eyebrow">期日パターン</span>
              <h3 className="sub-heading">「変な周期」も、ちゃんと設定できる。</h3>
              <p className="body-text">
                「隔週の資源ゴミ」も、「お風呂、最後に入ってから2日経ったら」も、同じアプリの中で扱えます。
              </p>

              <div className="pattern-grid">
                <div className="card pattern-card">
                  <h4>決まっているもの</h4>
                  <ul className="tag-list">
                    <li>毎日</li>
                    <li>曜日を指定（月・木だけ、など）</li>
                    <li>週に◯回</li>
                    <li>月に1回</li>
                  </ul>
                </div>
                <div className="card pattern-card accent">
                  <h4>なんとなく空いたら</h4>
                  <ul className="tag-list">
                    <li>前回やってから◯日経ったら</li>
                  </ul>
                  <p className="since-quote">
                    「そろそろ」は、お風呂や水回り掃除のような、起点を固定すると破綻する活動と相性がいい設定です。
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="rule" />

        {/* デイリー画面 */}
        <div className="wrap">
          <section className="split reveal">
            <div>
              <span className="eyebrow">デイリー画面</span>
              <h2>
                今日だけじゃない。
                <br />
                その日やることが、日付ごとに並ぶ。
              </h2>
              <p className="body-text">
                ◀ ▶ で日付を送れば、過去の記録づけも、数日先の予定確認もできます。「今日」だけを見るための画面ではありません。
              </p>
              <ul className="feature-list">
                <li>過去の日付に戻れば、その日にやったことを後から記録できる</li>
                <li>未来の日付は内容を確認できるだけ。「済」にできるのは、その日になってから</li>
                <li>今日以外を見ているときは「今日へ戻る」でワンタップ</li>
              </ul>
            </div>
            <div className="split-visual">
              <DailyDemo />
            </div>
          </section>
        </div>

        <div className="rule" />

        {/* 通知 */}
        <div className="wrap">
          <section className="reveal">
            <span className="eyebrow">通知は、1日2通だけ</span>
            <h2>
              通知が多すぎて、全部消してしまう。
              <br />
              それを、しくみで防ぎます。
            </h2>
            <p className="body-text">
              朝は今日やるべき分をまとめて1通。夜は、まだ終わってない分だけもう1通。時間は設定からいつでも変更できます。
            </p>

            <div className="notify-grid">
              <div className="toast-stack">
                <div className="card toast-card">
                  <div className="toast-icon">
                    <IconTabDaily size={16} />
                  </div>
                  <div className="toast-body">
                    <div className="toast-app">ZUMI</div>
                    <div className="toast-title">今日は3件あります</div>
                    <div className="toast-msg">ゴミ出し・プロテイン・英語学習</div>
                  </div>
                  <div className="toast-time">7:30</div>
                </div>
                <div className="card toast-card">
                  <div className="toast-icon">
                    <IconBell />
                  </div>
                  <div className="toast-body">
                    <div className="toast-app">ZUMI</div>
                    <div className="toast-title">まだ済んでいないものが1件</div>
                    <div className="toast-msg">寝る前に、お風呂だけ残っています</div>
                  </div>
                  <div className="toast-time">22:00</div>
                </div>
              </div>

              <div className="card settings-card">
                <div className="settings-eyebrow">設定 ▸ 通知</div>
                <div className="settings-item">
                  <div>
                    <div className="settings-item-label">朝の通知</div>
                    <div className="settings-item-sub">今日の分をまとめて通知</div>
                  </div>
                  <div className="settings-item-right">
                    <div className="toggle">
                      <div className="knob" />
                    </div>
                    <div className="time-pill">
                      7:30
                      <IconChevronRight size={10} />
                    </div>
                  </div>
                </div>
                <div className="settings-item">
                  <div>
                    <div className="settings-item-label">夜の通知</div>
                    <div className="settings-item-sub">未完了があれば知らせる</div>
                  </div>
                  <div className="settings-item-right">
                    <div className="toggle">
                      <div className="knob" />
                    </div>
                    <div className="time-pill">
                      22:00
                      <IconChevronRight size={10} />
                    </div>
                  </div>
                </div>
                <p className="settings-note">時間は1分単位で自由に変更できます。オフにすることもできます。</p>
              </div>
            </div>
            <p className="notify-total">
              1日に届く通知は、朝・夜あわせて最大<strong>2通</strong>。時間は設定画面からいつでも変更できます。
            </p>
          </section>
        </div>

        <div className="rule" />

        {/* 振り返り */}
        <div className="wrap">
          <section className="reveal">
            <span className="eyebrow">振り返り</span>
            <h2>
              週次は成績表、
              <br />
              月次は可視化、履歴はログ。
            </h2>
            <p className="body-text">
              連続記録（ストリーク）は競いません。サボった週があっても、先週との差分だけ見えればいい。3つとも見せたい情報なので、1画面に詰め込まず、上部の切り替えで行き来できるページに分けています。
            </p>

            {/* 週次サマリー */}
            <div className="review-block subsection">
              <div className="subrule" />
              <div className="split">
                <div>
                  <span className="sub-eyebrow">週次サマリー</span>
                  <h3 className="sub-heading">今週の「済」具合を、成績表みたいに受け取る。</h3>
                  <p className="body-text">
                    毎週、達成した数と先週との差分が届きます。Duty一つひとつの内訳も、済んだものも未達のものも隠さず並びます。そのままシェア画像として保存・投稿できます。
                  </p>
                </div>
                <div className="split-visual">
                  <div className="card summary-visual">
                    <div className="summary-head">
                      <div className="summary-range">2026.08.17 — 08.23</div>
                      <div className="summary-week">第34週</div>
                    </div>
                    <div className="summary-scorerow">
                      <div className="summary-num">18</div>
                      <div className="summary-den">/ 20</div>
                      <div className="summary-diff">先週 +3</div>
                    </div>
                    <p className="summary-caption">今週の「やらなきゃ」、だいたい済ませた</p>
                    <div className="summary-list">
                      <div className="summary-row">
                        <div className="icon">
                          <IconTrash size={19} />
                        </div>
                        <div className="info">
                          <div className="name">ゴミ出し</div>
                          <div className="sub">火・金</div>
                        </div>
                        <div className="summary-stamp" style={{ transform: "rotate(-9deg)" }}>
                          済
                        </div>
                      </div>
                      <div className="summary-row">
                        <div className="icon">
                          <IconBath size={19} />
                        </div>
                        <div className="info">
                          <div className="name">風呂</div>
                          <div className="sub">7日中 5日</div>
                        </div>
                        <div className="summary-stamp" style={{ transform: "rotate(6deg)" }}>
                          済
                        </div>
                      </div>
                      <div className="summary-row">
                        <div className="icon">
                          <IconProtein size={19} />
                        </div>
                        <div className="info">
                          <div className="name">プロテイン</div>
                          <div className="sub">7日中 7日</div>
                        </div>
                        <div className="summary-stamp" style={{ transform: "rotate(-4deg)" }}>
                          済
                        </div>
                      </div>
                      <div className="summary-row">
                        <div className="icon">
                          <IconBook size={19} />
                        </div>
                        <div className="info">
                          <div className="name muted">英語学習</div>
                          <div className="sub">週1回 → 未達</div>
                        </div>
                        <div className="summary-stamp dashed">来週</div>
                      </div>
                    </div>
                    <div className="summary-foot">
                      <div className="summary-brand">ZUMI</div>
                      <div className="summary-domain">zumi.paritto.dev</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 月次カレンダーヒートマップ */}
            <div className="review-block subsection">
              <div className="subrule" />
              <div className="split reverse">
                <div>
                  <span className="sub-eyebrow">月次カレンダーヒートマップ</span>
                  <h3 className="sub-heading">続いていることを、濃淡で眺める。</h3>
                  <p className="body-text">
                    1ヶ月分のマスに、その日の達成度をグラデーションで敷いていきます。数値よりも、途切れずに続いている実感そのものが伝わるように。タップすれば、その日の記録・予定ページも開けます。
                  </p>
                </div>
                <div className="split-visual">
                  <div className="card heat-visual">
                    <div className="heat-head2">
                      <div className="heat-navbtn">
                        <IconChevronLeft size={12} />
                      </div>
                      <div className="heat-month">2026年8月</div>
                      <div className="heat-navbtn">
                        <IconChevronRight size={12} />
                      </div>
                    </div>
                    <div className="weekday-row2">
                      <span>月</span>
                      <span>火</span>
                      <span>水</span>
                      <span>木</span>
                      <span>金</span>
                      <span>土</span>
                      <span>日</span>
                    </div>
                    <div className="heat-grid2">
                      {HEAT_CELLS.map((v, i) =>
                        v === null ? (
                          <div className="heat-cell2" style={{ background: "var(--paper-sunken)" }} key={i}>
                            <span style={{ opacity: 0.45 }}>–</span>
                          </div>
                        ) : (
                          <div
                            className="heat-cell2"
                            style={{
                              background:
                                v === 5
                                  ? "var(--vermillion)"
                                  : `color-mix(in srgb, var(--vermillion) ${v * 20}%, var(--paper-sunken))`,
                            }}
                            key={i}
                          >
                            <span style={{ color: v >= 3 ? "#fdf6ec" : "var(--ink-soft)" }}>{v}/5</span>
                          </div>
                        ),
                      )}
                    </div>
                    <div className="legend2">
                      <span className="lbl">未達成</span>
                      <div className="scale">
                        <div className="sw" style={{ background: "var(--paper-sunken)" }} />
                        <div className="sw" style={{ background: "color-mix(in srgb, var(--vermillion) 20%, var(--paper-sunken))" }} />
                        <div className="sw" style={{ background: "color-mix(in srgb, var(--vermillion) 50%, var(--paper-sunken))" }} />
                        <div className="sw" style={{ background: "color-mix(in srgb, var(--vermillion) 85%, var(--paper-sunken))" }} />
                        <div className="sw" style={{ background: "var(--vermillion)" }} />
                      </div>
                      <span className="lbl">全て済</span>
                    </div>
                    <p className="heat-note2">タップすると、その日の記録・予定ページを開けます</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 履歴 */}
            <div className="review-block subsection">
              <div className="subrule" />
              <div className="split">
                <div>
                  <span className="sub-eyebrow">履歴</span>
                  <h3 className="sub-heading">済ませたことも、スキップしたことも、そのままログに残す。</h3>
                  <p className="body-text">
                    日付ごとに、済ませたDutyとスキップしたDutyを並べて記録します。Duty名で絞り込んで、過去に遡って確認することもできます。
                  </p>
                </div>
                <div className="split-visual">
                  <div className="card hist-visual">
                    <div className="hist-filters">
                      <span className="hist-chip active">すべて</span>
                      <span className="hist-chip">ゴミ出し</span>
                      <span className="hist-chip">お風呂</span>
                      <span className="hist-chip">プロテイン</span>
                    </div>
                    {HISTORY_GROUPS.map((g) => (
                      <div className="hist-group" key={g.date}>
                        <div className="hist-date2">{g.date}</div>
                        {g.rows.map((row) => (
                          <div className="hist-row2" key={row.name + row.time}>
                            <div className="hist-icon2">
                              <row.icon size={16} />
                            </div>
                            <div className="hist-name2">{row.name}</div>
                            <div className="hist-time2">{row.time}</div>
                            <div className={`hist-badge2 ${row.badge}`}>{row.badge === "done" ? "済" : "スキップ"}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* FINAL CTA */}
        <div className="wrap">
          <section className="final-cta reveal" id="cta">
            <div className="seal-big">済</div>
            <h2>やることを、済ませるだけ。</h2>
            <div className="cta-row">
              <a className="btn btn-primary" href={SIGNUP_HREF}>
                無料ではじめる
              </a>
            </div>
          </section>
        </div>
      </main>

      <footer>
        <div className="wrap footer-row">
          <span>ZUMI（済） — 定期的な「やらなきゃ」を記録するアプリ</span>
          <ul className="footer-links">
            <li>
              <a href="/login">ログイン</a>
            </li>
            <li>
              <a href="/terms">利用規約</a>
            </li>
            <li>
              <a href="/privacy">プライバシーポリシー</a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
