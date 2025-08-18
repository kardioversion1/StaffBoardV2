import type { Staff } from "../state";

export function isEmployeeIdUnique(
  staff: Staff[],
  id: string,
  existingId?: string
): boolean {
  return !staff.some((s) => s.id === id && s.id !== existingId);
}

