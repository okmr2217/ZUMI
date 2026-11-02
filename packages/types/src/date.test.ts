import { describe, expect, it } from "vitest";
import { addDays, diffInDays, getWeekday, getWeekRange, toLocalDate } from "./date";

// カレンダーの確認用（2026年8月、月曜始まり）
//   月  火  水  木  金  土  日
//                       1   2
//    3   4   5   6   7   8   9
//   10  11  12  13  14  15  16

describe("toLocalDate", () => {
  it("Asia/Tokyo は UTC 15:00 で日付が変わる（0時ちょうどは翌日、直前は当日）", () => {
    expect(toLocalDate(new Date("2026-08-04T15:00:00.000Z"), "Asia/Tokyo")).toBe("2026-08-05");
    expect(toLocalDate(new Date("2026-08-04T14:59:59.999Z"), "Asia/Tokyo")).toBe("2026-08-04");
  });

  it("同じ時刻でも UTC では前日のまま", () => {
    expect(toLocalDate(new Date("2026-08-04T15:00:00.000Z"), "UTC")).toBe("2026-08-04");
  });

  it("UTC の0時ちょうどと直前", () => {
    expect(toLocalDate(new Date("2026-08-05T00:00:00.000Z"), "UTC")).toBe("2026-08-05");
    expect(toLocalDate(new Date("2026-08-04T23:59:59.999Z"), "UTC")).toBe("2026-08-04");
  });

  it("UTC より遅れているタイムゾーンでは前日になる", () => {
    // ニューヨークは夏時間で UTC-4。2026-08-05T03:00Z は 8/4 23:00
    expect(toLocalDate(new Date("2026-08-05T03:00:00.000Z"), "America/New_York")).toBe(
      "2026-08-04",
    );
  });

  it("年をまたぐ", () => {
    expect(toLocalDate(new Date("2026-12-31T15:00:00.000Z"), "Asia/Tokyo")).toBe("2027-01-01");
    expect(toLocalDate(new Date("2026-12-31T15:00:00.000Z"), "UTC")).toBe("2026-12-31");
  });

  it("月の1桁・日の1桁はゼロ埋めする", () => {
    expect(toLocalDate(new Date("2026-02-01T03:00:00.000Z"), "Asia/Tokyo")).toBe("2026-02-01");
  });
});

describe("addDays", () => {
  it("0日・正・負", () => {
    expect(addDays("2026-08-05", 0)).toBe("2026-08-05");
    expect(addDays("2026-08-05", 1)).toBe("2026-08-06");
    expect(addDays("2026-08-05", -1)).toBe("2026-08-04");
    expect(addDays("2026-08-05", 14)).toBe("2026-08-19");
  });

  it("月末・月初をまたぐ", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-09-01", -1)).toBe("2026-08-31");
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
  });

  it("2月末（平年・うるう年）", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("年をまたぐ・長い期間", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-08-05", 364)).toBe("2027-08-04");
    expect(addDays("2028-01-01", 366)).toBe("2029-01-01");
  });

  it("夏時間の切り替え日でもずれない（日付文字列だけで計算する）", () => {
    // 米国の夏時間開始 2026-03-08、終了 2026-11-01
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });
});

describe("diffInDays", () => {
  it("同じ日は 0、to が後なら正、前なら負", () => {
    expect(diffInDays("2026-08-05", "2026-08-05")).toBe(0);
    expect(diffInDays("2026-08-03", "2026-08-05")).toBe(2);
    expect(diffInDays("2026-08-05", "2026-08-03")).toBe(-2);
  });

  it("月・年をまたぐ", () => {
    expect(diffInDays("2026-08-31", "2026-09-01")).toBe(1);
    expect(diffInDays("2026-12-31", "2027-01-01")).toBe(1);
    expect(diffInDays("2026-01-01", "2027-01-01")).toBe(365);
    expect(diffInDays("2028-01-01", "2029-01-01")).toBe(366);
  });

  it("2月（平年・うるう年）", () => {
    expect(diffInDays("2026-02-28", "2026-03-01")).toBe(1);
    expect(diffInDays("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("夏時間の切り替えをまたいでも整数日", () => {
    expect(diffInDays("2026-03-07", "2026-03-09")).toBe(2);
    expect(diffInDays("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("getWeekday", () => {
  it("0=日 〜 6=土", () => {
    expect(getWeekday("2026-08-01")).toBe(6); // 土
    expect(getWeekday("2026-08-02")).toBe(0); // 日
    expect(getWeekday("2026-08-03")).toBe(1); // 月
    expect(getWeekday("2026-08-05")).toBe(3); // 水
    expect(getWeekday("2026-11-02")).toBe(1); // 月
    expect(getWeekday("2028-02-29")).toBe(2); // 火
    expect(getWeekday("2027-01-01")).toBe(5); // 金
  });
});

describe("getWeekRange", () => {
  describe("週の始まりが月曜", () => {
    it("週の途中の日は、その週の月曜〜日曜", () => {
      expect(getWeekRange("2026-08-05", 1)).toEqual({ start: "2026-08-03", end: "2026-08-09" });
    });

    it("月曜当日・日曜当日も同じ週", () => {
      expect(getWeekRange("2026-08-03", 1)).toEqual({ start: "2026-08-03", end: "2026-08-09" });
      expect(getWeekRange("2026-08-09", 1)).toEqual({ start: "2026-08-03", end: "2026-08-09" });
    });

    it("土→日は同じ週、日→月で週が変わる", () => {
      expect(getWeekRange("2026-08-08", 1)).toEqual({ start: "2026-08-03", end: "2026-08-09" });
      expect(getWeekRange("2026-08-09", 1)).toEqual({ start: "2026-08-03", end: "2026-08-09" });
      expect(getWeekRange("2026-08-10", 1)).toEqual({ start: "2026-08-10", end: "2026-08-16" });
    });

    it("月・年をまたぐ週", () => {
      expect(getWeekRange("2026-08-01", 1)).toEqual({ start: "2026-07-27", end: "2026-08-02" });
      expect(getWeekRange("2026-12-31", 1)).toEqual({ start: "2026-12-28", end: "2027-01-03" });
      expect(getWeekRange("2027-01-03", 1)).toEqual({ start: "2026-12-28", end: "2027-01-03" });
    });
  });

  describe("週の始まりが日曜", () => {
    it("週の途中の日は、その週の日曜〜土曜", () => {
      expect(getWeekRange("2026-08-05", 0)).toEqual({ start: "2026-08-02", end: "2026-08-08" });
    });

    it("日曜当日・土曜当日も同じ週", () => {
      expect(getWeekRange("2026-08-02", 0)).toEqual({ start: "2026-08-02", end: "2026-08-08" });
      expect(getWeekRange("2026-08-08", 0)).toEqual({ start: "2026-08-02", end: "2026-08-08" });
    });

    it("土→日で週が変わり、日→月は同じ週", () => {
      expect(getWeekRange("2026-08-08", 0)).toEqual({ start: "2026-08-02", end: "2026-08-08" });
      expect(getWeekRange("2026-08-09", 0)).toEqual({ start: "2026-08-09", end: "2026-08-15" });
      expect(getWeekRange("2026-08-10", 0)).toEqual({ start: "2026-08-09", end: "2026-08-15" });
    });

    it("月・年をまたぐ週", () => {
      expect(getWeekRange("2026-08-01", 0)).toEqual({ start: "2026-07-26", end: "2026-08-01" });
      expect(getWeekRange("2026-12-31", 0)).toEqual({ start: "2026-12-27", end: "2027-01-02" });
      expect(getWeekRange("2027-01-03", 0)).toEqual({ start: "2027-01-03", end: "2027-01-09" });
    });
  });
});
