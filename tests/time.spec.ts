import { describe, it, expect } from "vitest";
import { deriveShift, nextShiftTuple } from "../src/utils/time";

describe("deriveShift", () => {
  it("handles edges around anchors", () => {
    expect(deriveShift("06:59")).toBe("night");
    expect(deriveShift("07:00")).toBe("day");
    expect(deriveShift("18:59")).toBe("day");
    expect(deriveShift("19:00")).toBe("night");
  });
});

describe("nextShiftTuple", () => {
  it("rolls over at night", () => {
    expect(nextShiftTuple("2024-01-01", "day")).toEqual({
      dateISO: "2024-01-01",
      shift: "night",
    });
    expect(nextShiftTuple("2024-01-01", "night")).toEqual({
      dateISO: "2024-01-02",
      shift: "day",
    });
  });
});
