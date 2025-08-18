import { describe, it, expect } from "vitest";
import {
  ensureUniqueAssignment,
  startBreak,
  endBreak,
  type Slot,
  type Board,
} from "../src/slots";
import { isEmployeeIdUnique } from "../src/utils/staff";
import { nurseTile as renderTile } from "../src/ui/nurseTile";

describe("ensureUniqueAssignment", () => {
  it("removes duplicates across board", () => {
    const board: Board = {
      charge: { nurseId: "1" },
      triage: { nurseId: "2" },
      zones: { A: [{ nurseId: "1" }, { nurseId: "3" }], B: [{ nurseId: "2" }] },
    };
    ensureUniqueAssignment(board, "1");
    expect(board.charge).toBeUndefined();
    expect(board.zones.A).toEqual([{ nurseId: "3" }]);
    ensureUniqueAssignment(board, "2");
    expect(board.triage).toBeUndefined();
    expect(board.zones.B).toEqual([]);
  });
});

describe("break toggles", () => {
  it("starts and ends break with covering display", () => {
    const slot: Slot = { nurseId: "1" };
    startBreak(slot, { rf: "55221712" }, "12:00", "2024-01-01T00:00:00.000Z");
    expect(slot.break?.active).toBe(true);
    const html = renderTile(slot, {
      id: "1",
      name: "Alice",
      type: "other",
    });
    expect(html).toContain("⏸️");
    endBreak(slot);
    expect(slot.break?.active).toBe(false);
  });
});

describe("employee ID uniqueness", () => {
  it("detects conflicts", () => {
    const staff = [
      { id: "1", name: "A", type: "other" },
      { id: "2", name: "B", type: "other" },
    ];
    expect(isEmployeeIdUnique(staff, "3")).toBe(true);
    expect(isEmployeeIdUnique(staff, "2")).toBe(false);
    expect(isEmployeeIdUnique(staff, "2", "2")).toBe(true);
  });
});

describe("nurse tile snapshot", () => {
  it("renders chips", () => {
    const slot: Slot = {
      nurseId: "1",
      student: "S1",
      comment: "note",
      break: {
        active: true,
        startISO: "2024-01-01T00:00:00.000Z",
        plannedEndHHMM: "12:30",
        relievedBy: { rf: "552" },
      },
      endTimeOverrideHHMM: "13:00",
      dto: true,
    };
    const html = renderTile(slot, {
      id: "1",
      name: "Alice",
      type: "other",
    });
    expect(html).toMatchInlineSnapshot(
      `"<div class=\"nurse-pill\" data-type=\"other\" tabindex=\"0\" aria-label=\"Alice, other nurse, on break, has student, has comment\"><span class=\"nurse-name\">Alice</span><span class=\"chips\"><span class=\"chip\" aria-label=\"On break\"><span class=\"icon\">⏸️</span></span><span class=\"chip\" aria-label=\"Has student\"><span class=\"icon\">🎓</span></span><span class=\"chip\" aria-label=\"Has comment\"><span class=\"icon\">💬</span></span></span></div>"`
    );
  });
});

