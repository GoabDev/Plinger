import { describe, expect, it } from "vitest";
import { inActivityMonth, monthBounds, monthSearch, resolveActivityMonth } from "./activity-month";

describe("activity month", () => {
  it("defaults invalid or ambiguous selections to the current UTC month", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    for (const value of [undefined, "2026-13", "2026-9", ["2026-09", "all"]]) {
      expect(resolveActivityMonth(value, now)).toBe("2026-10");
    }
    expect(resolveActivityMonth("all", now)).toBe("all");
    expect(resolveActivityMonth("2025-01", now)).toBe("2025-01");
  });

  it("includes the first instant and excludes the next month, across year boundaries", () => {
    expect(monthBounds("2026-12")).toEqual({ start: "2026-12-01T00:00:00.000Z", end: "2027-01-01T00:00:00.000Z" });
    expect(inActivityMonth("2026-12-01T00:00:00Z", "2026-12")).toBe(true);
    expect(inActivityMonth("2027-01-01T00:00:00Z", "2026-12")).toBe(false);
    expect(inActivityMonth(null, "2026-12")).toBe(false);
    expect(monthSearch("2024-02", "closed")).toBe("closed:2024-02-01..2024-02-29");
  });
});
