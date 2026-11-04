"use client";

import { useEffect, useRef, useState } from "react";
import "./lp.css";
import {
  IconBell,
  IconBook,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconFan,
  IconGear,
  IconHistory,
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

/**
 * サインアップへの CTA。公開前でサインアップを閉じている間（docs/05「ドメイン構成」）は
 * リンクにせず、押せない「公開準備中」表示にする。
 */
function SignupCta({ enabled, small = false }: { enabled: boolean; small?: boolean }) {
  const size = small ? " btn-small" : "";
  if (!enabled) {
    return <span className={`btn btn-soon${size}`}>公開準備中</span>;
  }
  return (
    <a className={`btn btn-primary${size}`} href={SIGNUP_HREF}>
      無料ではじめる
    </a>
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
                <button
                  className="hanko animate"
                  aria-pressed="true"
                  aria-label="プロテインは済みました"
                  disabled
                >
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
                <IconClock />
              </div>
              <div className="app-row-main">
                <div className="app-row-name">水回り掃除</div>
                <div className="badge-warn">前回から10日</div>
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
  { icon: IconHistory, name: "洗濯槽の掃除", sub: "前回から1ヶ月空いたら" },
  { icon: IconProtein, name: "プロテイン", sub: "毎日" },
  { icon: IconBook, name: "英語学習", sub: "週に2回" },
  { icon: IconRead, name: "シーツ交換", sub: "月に1回くらい" },
  { icon: IconClock, name: "水回り掃除", sub: "前回から10日空いたら" },
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
      { icon: IconClock, name: "水回り掃除", time: "22:30", badge: "skip" as const },
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

const HEAT_CELLS = [null, 4, 2, 3, 4, 1, 3, 4, 4, 3, null, 4, 5, 3, 4, 4, 5, 3, 4, 5, 4];

export function LandingPage({ signupEnabled }: { signupEnabled: boolean }) {
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
          <SignupCta enabled={signupEnabled} small />
        </nav>
      </header>

      <main id="top">
        {/* HERO */}
        <div className="wrap">
          <section className="hero">
            <div>
              <span className="eyebrow">毎日・定期的な「やらなきゃ」の記録アプリ</span>
              <h1>
                やったら「済」。
                <br />
                忘れていたら、
                <br />
                教えてくれる。
              </h1>
              <p className="sub">
                毎日のことも、週に何回かのことも、月イチのことも。
                <br />
                やったら「済」を押すだけ。
                <br />
                まだのものは、夜に通知が知らせてくれます。
              </p>
              <div className="cta-row">
                <SignupCta enabled={signupEnabled} />
                <span className="hint">
                  {signupEnabled ? "クレジットカード不要" : "ただいま公開に向けて準備しています"}
                </span>
              </div>
            </div>

            <HeroCard />
          </section>
        </div>

        <div className="rule" />

        {/* つくった理由 + しくみは2つだけ。起点は「続けたいことを続ける」こと */}
        <div className="wrap">
          <section className="reveal">
            <span className="eyebrow">ZUMI をつくった理由</span>
            <h2>
              続けようと決めたことが、
              <br />
              意外と続かない。
            </h2>
            <p className="body-text">
              プロテインも、英語の勉強も、筋トレも。始めるときは本気なのに、気づくと何日も空いている。
            </p>
            <p className="body-text">
              足りなかったのは、意志ではありませんでした。やったかどうかを残しておく場所と、忘れたときに思い出させてくれる仕組み。ZUMIは、それをつくるところから始まっています。
            </p>

            <div className="subsection">
              <div className="subrule" />
              <span className="sub-eyebrow">しくみ</span>
              <h3 className="sub-heading">しくみは、2つだけ。</h3>
              <div className="pattern-grid">
                <div className="card pattern-card origin-card">
                  <span className="origin-num">1</span>
                  <h4>やったら、「済」を押す。</h4>
                  <p>
                    書くことも、数えることもありません。朱印をワンタップすれば、その日の分は記録されます。
                  </p>
                </div>
                <div className="card pattern-card origin-card">
                  <span className="origin-num">2</span>
                  <h4>やっていなければ、教えてくれる。</h4>
                  <p>
                    まだ済んでいないものは、夜に通知が教えてくれます。忘れていたことを、寝る前に拾えます。
                  </p>
                </div>
              </div>
              <p className="since-quote origin-note">
                何日続いたかは数えません。途切れても、また次の日に押せばいい。
              </p>
            </div>
          </section>
        </div>

        <div className="rule" />

        {/* 通知。「やっていないことを教えてくれる」は訴求の柱なので、Duty の例より前に置く */}
        <div className="wrap">
          <section className="reveal">
            <span className="eyebrow">通知</span>
            <h2>
              やっていないことを、
              <br />
              夜に教えてくれる。
            </h2>
            <p className="body-text">
              朝は、今日やる分をまとめて1通。夜は、まだ済んでいないものだけをもう1通。済ませたものは載らないので、全部済ませた日の夜は何も届きません。
            </p>
            <ul className="feature-list">
              <li>「前回から◯日」のものは、日が空いてきたら「そろそろ」として届きます</li>
              <li>「週に2回」のものは、このままだと今週に間に合わなくなる日から届きます</li>
              <li>届くのは1日に最大2通。通知が多すぎて全部切ってしまう、を防ぎます</li>
            </ul>

            <div className="notify-grid">
              <div className="toast-stack">
                <div className="card toast-card">
                  <div className="toast-icon">
                    <IconTabDaily size={16} />
                  </div>
                  <div className="toast-body">
                    <div className="toast-app">ZUMI</div>
                    <div className="toast-title">今日の Duty 3件</div>
                    <div className="toast-msg">
                      ゴミ出し（可燃）・プロテイン・水回り掃除（そろそろ）
                    </div>
                  </div>
                  <div className="toast-time">7:30</div>
                </div>
                <div className="card toast-card">
                  <div className="toast-icon">
                    <IconBell />
                  </div>
                  <div className="toast-body">
                    <div className="toast-app">ZUMI</div>
                    <div className="toast-title">まだ済んでいないもの 1件</div>
                    <div className="toast-msg">英語学習（あと1回・日曜まで）</div>
                  </div>
                  <div className="toast-time">22:00</div>
                </div>
                <p className="toast-quiet">全部「済」にした日は、夜の通知は届きません</p>
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
                <p className="settings-note">
                  時間は1分単位で自由に変更できます。オフにすることもできます。
                </p>
              </div>
            </div>
            <p className="notify-total">
              iPhone では、ZUMI をホーム画面に追加すると通知が届くようになります。
            </p>
          </section>
        </div>

        <div className="rule" />

        {/* 毎日も、定期的も。どんな「やらなきゃ」を扱うのか + 期日パターン */}
        <div className="wrap">
          <section className="reveal">
            <span className="eyebrow">毎日も、定期的も</span>
            <h2>
              毎日のことも、定期的なことも、
              <br />
              ひとつの場所で。
            </h2>
            <p className="body-text">
              毎日続けたいことのために作った仕組みは、ゴミ出しや月イチの掃除のような「定期的にやってくること」にも、そのまま使えます。なりたい自分のためでも、やらなきゃいけないことでもかまいません。
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
            <p className="cat-note">
              ここに挙げたのは一例です。テンプレートから選ぶことも、自由入力で追加することもできます。
            </p>

            <div className="subsection">
              <div className="subrule" />
              <span className="sub-eyebrow">期日パターン</span>
              <h3 className="sub-heading">「変な周期」も、ちゃんと設定できる。</h3>
              <p className="body-text">
                「隔週の資源ゴミ」も、「シーツ、前回替えてから2週間経ったら」も、同じアプリの中で扱えます。
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
                    「そろそろ」は、シーツ交換や水回り掃除のような、起点を固定すると破綻する活動と相性がいい設定です。
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="rule" />

        {/* 振り返り。週次サマリーを主役にし、月次ヒートマップと履歴は小さく添える */}
        <div className="wrap">
          <section className="reveal">
            <span className="eyebrow">振り返り</span>
            <h2>
              今週どれだけ済ませたかを、
              <br />
              成績表みたいに受け取る。
            </h2>
            <p className="body-text">
              連続記録（ストリーク）は競いません。サボった週があっても、先週との差分だけ見えればいい。
            </p>

            {/* 週次サマリー */}
            <div className="review-block subsection">
              <div className="subrule" />
              <div className="split">
                <div>
                  <span className="sub-eyebrow">週次サマリー</span>
                  <h3 className="sub-heading">今週の「済」具合が、1枚のカードで届く。</h3>
                  <p className="body-text">
                    毎週、達成した数と先週との差分が届きます。済んだものも未達のものも隠さず並び、そのままシェア画像として保存・投稿できます。
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
                          <IconRead size={19} />
                        </div>
                        <div className="info">
                          <div className="name">シーツ交換</div>
                          <div className="sub">月に1回</div>
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

            {/* 月次カレンダーヒートマップと履歴 */}
            <div className="review-block subsection">
              <div className="subrule" />
              <div className="review-mini-grid">
                <div>
                  <span className="sub-eyebrow">月次カレンダー</span>
                  <h4 className="mini-heading">続いていることを、濃淡で眺める。</h4>
                  <p className="mini-text">
                    1ヶ月分のマスに、その日の達成度を敷いていきます。タップすれば、その日の記録を開けます。
                  </p>
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
                          <div
                            className="heat-cell2"
                            style={{ background: "var(--paper-sunken)" }}
                            key={i}
                          >
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
                            <span style={{ color: v >= 3 ? "#fdf6ec" : "var(--ink-soft)" }}>
                              {v}/5
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                    <div className="legend2">
                      <span className="lbl">未達成</span>
                      <div className="scale">
                        <div className="sw" style={{ background: "var(--paper-sunken)" }} />
                        <div
                          className="sw"
                          style={{
                            background:
                              "color-mix(in srgb, var(--vermillion) 20%, var(--paper-sunken))",
                          }}
                        />
                        <div
                          className="sw"
                          style={{
                            background:
                              "color-mix(in srgb, var(--vermillion) 50%, var(--paper-sunken))",
                          }}
                        />
                        <div
                          className="sw"
                          style={{
                            background:
                              "color-mix(in srgb, var(--vermillion) 85%, var(--paper-sunken))",
                          }}
                        />
                        <div className="sw" style={{ background: "var(--vermillion)" }} />
                      </div>
                      <span className="lbl">全て済</span>
                    </div>
                  </div>
                </div>
                <div>
                  <span className="sub-eyebrow">履歴</span>
                  <h4 className="mini-heading">済ませたことも、スキップしたことも残る。</h4>
                  <p className="mini-text">
                    日付ごとに並べて記録します。Duty名で絞り込んで、過去に遡ることもできます。
                  </p>
                  <div className="card hist-visual">
                    <div className="hist-filters">
                      <span className="hist-chip active">すべて</span>
                      <span className="hist-chip">ゴミ出し</span>
                      <span className="hist-chip">水回り掃除</span>
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
                            <div className={`hist-badge2 ${row.badge}`}>
                              {row.badge === "done" ? "済" : "スキップ"}
                            </div>
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
              <SignupCta enabled={signupEnabled} />
            </div>
          </section>
        </div>
      </main>

      <footer>
        <div className="wrap footer-row">
          <span>ZUMI（済） — 毎日・定期的な「やらなきゃ」の記録アプリ</span>
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
