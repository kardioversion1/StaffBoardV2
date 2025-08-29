/** Allowed user roles. */
export type Role = 'nurse' | 'tech';

/**
 * Ensure a user object has a valid role.
 * @param u user object to check
 * @returns nothing
 */
export function ensureRole(u: { role: string }): asserts u is { role: Role } {
  if (u.role !== 'nurse' && u.role !== 'tech') {
    throw new Error(`Invalid role: ${u.role}`);
  }
}
