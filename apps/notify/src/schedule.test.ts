import { describe, expect, it } from "vitest";
import {
  getCandidateLocalTimes,
  getDueNotifications,
  toLocalTime,
  type NotifySettings,
} from "./schedule";

// 2026-11-02 は月曜、2026-11-08 は日曜
const settings = (overrides: Partial<NotifySettings> = {}): NotifySettings => ({
  userId: "u1",
  timezone: "Asia/Tokyo",
  morningNotifyEnabled: true,
  morningNotifyAt: "08:00",
  eveningNotifyEnabled: true,
  eveningNotifyAt: "21:00",
  weeklySummaryEnabled: true,
  weeklySummaryAt: "20:00",
  weekStart: 1,
  ...overrides,
});

describe("toLocalTime", () => {
  it("タイムゾーンでの HH:MM を返す（0時は 00、24 にはならない）", () => {
    expect(toLocalTime(new Date("2026-11-01T23:00:00Z"), "Asia/Tokyo")).toBe("08:00");
    expect(toLocalTime(new Date("2026-11-01T15:00:00Z"), "Asia/Tokyo")).toBe("00:00");
    expect(toLocalTime(new Date("2026-11-01T15:59:30Z"), "Asia/Tokyo")).toBe("00:59");
    expect(toLocalTime(new Date("2026-11-02T03:30:00Z"), "Asia/Kolkata")).toBe("09:00");
    expect(toLocalTime(new Date("2026-11-02T00:00:00Z"), "UTC")).toBe("00:00");
  });

  it("夏時間を反映する", () => {
    // ニューヨーク: 2026-11-01 に夏時間が終わる（-04:00 → -05:00）
    expect(toLocalTime(new Date("2026-10-31T12:00:00Z"), "America/New_York")).toBe("08:00");
    expect(toLocalTime(new Date("2026-11-02T12:00:00Z"), "America/New_York")).toBe("07:00");
  });

  it("不正なタイムゾーンは RangeError", () => {
    expect(() => toLocalTime(new Date(), "Mars/Olympus")).toThrow(RangeError);
  });
});

describe("getCandidateLocalTimes", () => {
  const instant = new Date("2026-11-01T23:00:00Z");

  it("渡したタイムゾーンの現地時刻を重複なく昇順で返す", () => {
    expect(
      getCandidateLocalTimes(instant, ["Asia/Tokyo", "Asia/Seoul", "UTC", "Asia/Kolkata"]),
    ).toEqual(["04:30", "08:00", "23:00"]);
  });

  it("既定では実行環境の全タイムゾーンを使い、オフセットの種類ぶん（40前後）に収まる", () => {
    const times = getCandidateLocalTimes(instant);
    expect(times).toContain("08:00"); // Asia/Tokyo
    expect(times).toContain("23:00"); // UTC
    expect(times).toContain("04:30"); // Asia/Kolkata
    expect(times).toContain("04:45"); // Asia/Kathmandu
    expect(times.length).toBeLessThan(60);
  });

  it("タイムゾーン一覧が使えなければ、-12:00〜+14:00 の15分刻みを候補にする", () => {
    const times = getCandidateLocalTimes(instant, null);
    // 26時間ぶんなので24時間で折り返し、15分刻みの全時刻になる
    expect(times).toHaveLength(96);
    expect(times).toContain("08:00");
    expect(times).toContain("11:00"); // -12:00
    expect(times).toContain("13:00"); // +14:00
    expect(times).toContain("04:45");
  });
});

describe("getDueNotifications", () => {
  it("朝・夜の通知時刻がユーザーの現地時刻と一致したら返す", () => {
    expect(getDueNotifications(settings(), new Date("2026-11-01T23:00:00Z"))).toEqual({
      today: "2026-11-02",
      kinds: ["MORNING"],
    });
    expect(getDueNotifications(settings(), new Date("2026-11-02T12:00:00Z"))).toEqual({
      today: "2026-11-02",
      kinds: ["EVENING"],
    });
    expect(getDueNotifications(settings(), new Date("2026-11-01T23:01:00Z")).kinds).toEqual([]);
  });

  it("オフの通知・時刻が未設定の通知は返さない", () => {
    const at = new Date("2026-11-01T23:00:00Z");
    expect(getDueNotifications(settings({ morningNotifyEnabled: false }), at).kinds).toEqual([]);
    expect(
      getDueNotifications(settings({ morningNotifyAt: null, eveningNotifyAt: null }), at).kinds,
    ).toEqual([]);
  });

  it("「今日」はユーザーのタイムゾーンの0時で切り替わる", () => {
    const at = new Date("2026-11-01T15:00:00Z"); // 東京 11/2 00:00、UTC 11/1 15:00
    expect(getDueNotifications(settings({ morningNotifyAt: "00:00" }), at)).toEqual({
      today: "2026-11-02",
      kinds: ["MORNING"],
    });
    expect(
      getDueNotifications(settings({ timezone: "UTC", morningNotifyAt: "15:00" }), at).today,
    ).toBe("2026-11-01");
  });

  describe("週次サマリーは週の最終日だけ", () => {
    // 東京 20:00 = UTC 11:00
    const at = (date: string) => new Date(`${date}T11:00:00Z`);

    it("月曜始まりなら日曜", () => {
      expect(getDueNotifications(settings(), at("2026-11-08")).kinds).toEqual(["WEEKLY"]);
      expect(getDueNotifications(settings(), at("2026-11-07")).kinds).toEqual([]);
      expect(getDueNotifications(settings(), at("2026-11-02")).kinds).toEqual([]);
    });

    it("日曜始まりなら土曜", () => {
      expect(getDueNotifications(settings({ weekStart: 0 }), at("2026-11-07")).kinds).toEqual([
        "WEEKLY",
      ]);
      expect(getDueNotifications(settings({ weekStart: 0 }), at("2026-11-08")).kinds).toEqual([]);
    });

    it("オフなら送らない", () => {
      expect(
        getDueNotifications(settings({ weeklySummaryEnabled: false }), at("2026-11-08")).kinds,
      ).toEqual([]);
    });
  });

  it("同じ時刻の通知はまとめて返す", () => {
    const s = settings({ eveningNotifyAt: "20:00" });
    expect(getDueNotifications(s, new Date("2026-11-08T11:00:00Z")).kinds).toEqual([
      "EVENING",
      "WEEKLY",
    ]);
  });

  it("不正なタイムゾーンは RangeError（呼び出し側がユーザー単位で捕まえる）", () => {
    expect(() => getDueNotifications(settings({ timezone: "Invalid/Zone" }), new Date())).toThrow(
      RangeError,
    );
  });
});
