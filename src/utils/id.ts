/**
 * Generate a prefixed staff id.
 * @returns new staff id
 */
export function createStaffId(): string {
  const uuid = crypto.randomUUID();
  return `00-${uuid}`;
}

/**
 * Ensure id uses staff prefix.
 * @param id raw identifier
 * @returns normalized id
 */
export function ensureStaffId(id: string): string {
  return id.startsWith('00-') ? id : `00-${id}`;
}
