export interface ZoneDef {
  id: string;
  name: string;
  color?: string;
  /** Whether the zone is part of the patient care team area. */
  pct?: boolean;
}

/**
 * Normalize zones into { id, name, color } objects.
 * @param input raw config zone list
 * @returns normalized zone definitions
 */
export function normalizeZones(input: any[]): ZoneDef[] {
  if (!Array.isArray(input)) return [];

  return input.map((z, i) => {
    if (typeof z === 'string') {
      return {
        id: z.toLowerCase().replace(/\s+/g, '_'),
        name: z,
        color: 'var(--panel)',
        pct: false,
      };
    } else if (typeof z === 'object' && z !== null) {
      const name = z.name ?? String(z.id ?? `Zone ${i + 1}`);
      return {
        id: (z.id ?? name).toLowerCase().replace(/\s+/g, '_'),
        name,
        color: z.color ?? 'var(--panel)',
        pct: !!(z as any).pct,
      };
    } else {
      return {
        id: `zone_${i}`,
        name: `Zone ${i + 1}`,
        color: 'var(--panel)',
        pct: false,
      };
    }
  });
}

/**
 * Ensure active.zones keys align with normalized zone names.
 * @param active active board object
 * @param zones normalized zones
 * @returns nothing
 */
export function normalizeActiveZones(active: any, zones: ZoneDef[]): void {
  if (!active || typeof active !== 'object') return;
  if (!active.zones || typeof active.zones !== 'object') active.zones = {};
  const normalized: Record<string, any[]> = {};
  for (const z of zones) {
    const arr = active.zones[z.name];
    normalized[z.name] = Array.isArray(arr) ? arr : [];
  }
  active.zones = normalized;
}
