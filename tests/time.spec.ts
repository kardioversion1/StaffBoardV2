import { describe, it, expect, vi } from "vitest";
vi.mock('@/db', () => {
  const store: Record<string, any> = {};
  return {
    get: async (k: string) => store[k],
    set: async (k: string, v: any) => {
      store[k] = v;
    },
    del: async (k: string) => {
      delete store[k];
    },
    keys: async () => Object.keys(store),
  };
});
import { deriveShift, nextShiftTuple } from '@/utils/time';
import { loadConfig } from '@/state/config';
import { set } from '@/db';

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

describe("loadConfig anchors", () => {
  it("fills default day/night anchors", async () => {
    await set("CONFIG", { zones: [], anchors: { day: "08:00" } });
    const cfg = await loadConfig();
    expect(cfg.anchors.day).toBe("08:00");
    expect(cfg.anchors.night).toBe("19:00");
  });
});
