import { describe, expect, it } from "vitest";
import type { NotificationItem } from "./digest";
import {
  BODY_MAX_LENGTH,
  buildEveningMessage,
  buildMorningMessage,
  buildWeeklyMessage,
  formatItem,
  formatItemList,
} from "./messages";

// 2026-11-02 は月曜、2026-11-08 は日曜
const MONDAY = "2026-11-02";
const SUNDAY = "2026-11-08";

const today = (name: string): NotificationItem => ({ name, section: "TODAY" });
const soon = (name: string): NotificationItem => ({ name, section: "SOON" });
const week = (name: string, remaining: number, weekEnd = SUNDAY): NotificationItem => ({
  name,
  section: "THIS_WEEK",
  remaining,
  weekEnd,
});

/** 絵文字（記号・絵文字の Extended_Pictographic） */
const EMOJI = /\p{Extended_Pictographic}/u;

describe("formatItem", () => {
  it("今日は名前だけ、そろそろ・今週は括弧で補足する", () => {
    expect(formatItem(today("プロテイン"), MONDAY)).toBe("プロテイン");
    expect(formatItem(soon("お風呂"), MONDAY)).toBe("お風呂（そろそろ）");
    expect(formatItem(week("英語学習", 1), MONDAY)).toBe("英語学習（あと1回・日曜まで）");
  });

  it("週の最終日が今日なら「今日まで」", () => {
    expect(formatItem(week("英語学習", 1), SUNDAY)).toBe("英語学習（あと1回・今日まで）");
  });

  it("日曜始まりの週は土曜まで", () => {
    expect(formatItem(week("ジム", 2, "2026-11-07"), MONDAY)).toBe("ジム（あと2回・土曜まで）");
  });
});

describe("formatItemList", () => {
  it("「・」でつなぐ", () => {
    expect(
      formatItemList([today("ゴミ出し（可燃）"), today("プロテイン"), soon("お風呂")], MONDAY),
    ).toBe("ゴミ出し（可燃）・プロテイン・お風呂（そろそろ）");
  });

  it("長い場合は「ほか N件」で省略し、目安の長さに収める", () => {
    const names = ["ゴミ出し（可燃）", "プロテイン", "英語学習", "ストレッチ", "日記", "掃除機"];
    // 全部つなぐと 42 文字
    const items = [...names, "洗濯", "植物の水やり"].map(today);
    const text = formatItemList(items, MONDAY);
    expect(text).toBe(`${names.join("・")} ほか 2件`);
    expect(text.length).toBeLessThanOrEqual(BODY_MAX_LENGTH);
  });

  it("1件目だけで長さを超えても、1件目は載せる", () => {
    const long = "とても長い名前の Duty ".repeat(4);
    expect(formatItemList([today(long), today("日記")], MONDAY)).toBe(`${long} ほか 1件`);
    expect(formatItemList([today(long)], MONDAY)).toBe(long);
  });
});

describe("buildMorningMessage", () => {
  it("docs/02 の例どおり", () => {
    expect(
      buildMorningMessage([today("ゴミ出し（可燃）"), today("プロテイン"), soon("お風呂")], MONDAY),
    ).toEqual({
      title: "今日の Duty 3件",
      body: "ゴミ出し（可燃）・プロテイン・お風呂（そろそろ）",
      url: "/app",
      tag: "zumi-morning",
    });
  });

  it("件数は省略した分も含めた全件", () => {
    const items = Array.from({ length: 12 }, (_, i) => today(`Duty${i + 1}`));
    expect(buildMorningMessage(items, MONDAY)?.title).toBe("今日の Duty 12件");
  });

  it("対象がゼロなら送らない", () => {
    expect(buildMorningMessage([], MONDAY)).toBeNull();
  });
});

describe("buildEveningMessage", () => {
  it("docs/02 の例どおり", () => {
    expect(buildEveningMessage([today("プロテイン"), week("英語学習", 1)], MONDAY)).toEqual({
      title: "まだ済んでいないもの 2件",
      body: "プロテイン・英語学習（あと1回・日曜まで）",
      url: "/app",
      tag: "zumi-evening",
    });
  });

  it("未完了がゼロなら送らない", () => {
    expect(buildEveningMessage([], MONDAY)).toBeNull();
  });
});

describe("buildWeeklyMessage", () => {
  it("docs/02 の例どおり（前週比は済んだ数の差）", () => {
    expect(
      buildWeeklyMessage({ thisWeek: { done: 18, total: 20 }, lastWeek: { done: 15, total: 19 } }),
    ).toEqual({
      title: "今週は 18/20",
      body: "先週より +3。シェア用のカードができています",
      url: "/app/review",
      tag: "zumi-weekly",
    });
  });

  it("減った週・同じ週", () => {
    expect(
      buildWeeklyMessage({ thisWeek: { done: 10, total: 20 }, lastWeek: { done: 12, total: 20 } })
        ?.body,
    ).toBe("先週より -2。シェア用のカードができています");
    expect(
      buildWeeklyMessage({ thisWeek: { done: 12, total: 20 }, lastWeek: { done: 12, total: 14 } })
        ?.body,
    ).toBe("先週と同じ。シェア用のカードができています");
  });

  it("先週の対象がなければ前週比は出さない", () => {
    expect(
      buildWeeklyMessage({ thisWeek: { done: 3, total: 5 }, lastWeek: { done: 0, total: 0 } })
        ?.body,
    ).toBe("シェア用のカードができています");
  });

  it("今週の対象がなければ送らない", () => {
    expect(
      buildWeeklyMessage({ thisWeek: { done: 0, total: 0 }, lastWeek: { done: 4, total: 5 } }),
    ).toBeNull();
  });
});

describe("文面のルール", () => {
  it("「催促」と絵文字を使わない", () => {
    const messages = [
      buildMorningMessage([today("A"), soon("B"), week("C", 2)], MONDAY),
      buildEveningMessage([soon("B"), week("C", 1)], SUNDAY),
      buildWeeklyMessage({ thisWeek: { done: 1, total: 2 }, lastWeek: { done: 0, total: 1 } }),
    ];
    for (const message of messages) {
      const text = `${message!.title} ${message!.body}`;
      expect(text).not.toContain("催促");
      expect(text).not.toMatch(EMOJI);
    }
  });
});
