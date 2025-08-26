export function createStaffId(): string {
  const uuid = crypto.randomUUID();
  return `00-${uuid}`;
}

export function ensureStaffId(id: string): string {
  return id.startsWith('00-') ? id : `00-${id}`;
}
