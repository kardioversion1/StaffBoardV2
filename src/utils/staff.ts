import type { Staff } from "../state";

/**
 * Check if an employee id is unique in a list.
 * @param staff staff array to search
 * @param id id to validate
 * @param existingId ignore this id when editing
 * @returns true if id is unique
 */
export function isEmployeeIdUnique(
  staff: Staff[],
  id: string,
  existingId?: string
): boolean {
  return !staff.some((s) => s.id === id && s.id !== existingId);
}

