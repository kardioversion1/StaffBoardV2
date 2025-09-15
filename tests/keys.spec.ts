import { describe, it, expect } from "vitest";
import { KS } from '@/state';

describe("KS helpers", () => {
  it("produces key strings", () => {
    expect(KS.PHYS("2024-01-01")).toBe("PHYS:2024-01-01");
    expect(KS.ACTIVE("2024-01-01", "day")).toBe("ACTIVE:2024-01-01:day");
    expect(KS.ONBAT("2024-01-01", "day")).toBe("ONBAT:2024-01-01:day");
    expect(KS.DRAFT("2024-01-01", "night")).toBe("DRAFT:2024-01-01:night");
  });
});
