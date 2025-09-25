export interface ZoneDef {
  id: string;
  name: string;
  color?: string | undefined;
  /** Whether the zone is part of the patient care team area. */
  pct?: boolean | undefined;
}

function toSlugId(raw: string, fallback: string): string {
  const base = (raw || fallback || "zone")
    .normalize("NFKD")                    // strip diacritics
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "zone";
}

/**
 * Normalize zones into { id, name, color, pct } with stable IDs and de-dupes.
 * @param input raw config zone list
 * @returns normalized zone definitions
 */
export function normalizeZones(
  input: Array<string | Partial<ZoneDef>>
): ZoneDef[] {
  if (!Array.isArray(input)) return [];

  const seenIds = new Map<string, number>();

  const withUniqueId = (baseId: string) => {
    const n = (seenIds.get(baseId) ?? 0) + 1;
    seenIds.set(baseId, n);
    return n === 1 ? baseId : `${baseId}_${n}`;
  };

  return input.map((z, i) => {
    if (typeof z === "string") {
      const name = z.trim();
      const id = withUniqueId(toSlugId(name, `zone_${i + 1}`));
      return {
        id,
        name: name || `Zone ${i + 1}`,
        color: "var(--panel)",
        pct: false,
      };
    }

    if (z && typeof z === "object") {
      const name = (z.name ?? String(z.id ?? `Zone ${i + 1}`)).toString().trim();
      const baseId = toSlugId((z.id as string) ?? name, `zone_${i + 1}`);
      const id = withUniqueId(baseId);
      return {
        id,
        name: name || `Zone ${i + 1}`,
        color: z.color ?? "var(--panel)",
        pct: Boolean(z.pct),
      };
    }

    const id = withUniqueId(`zone_${i + 1}`);
    return {
      id,
      name: `Zone ${i + 1}`,
      color: "var(--panel)",
      pct: false,
    };
  });
}

/**
 * Ensure active.zones keys align with normalized zone names.
 * @param active active board object
 * @param zones normalized zones
 */
export function normalizeActiveZones<T>(
  active: { zones?: Record<string, T[]> } | undefined,
  zones: ZoneDef[]
): void {
  if (!active || typeof active !== "object") return;
  if (!active.zones || typeof active.zones !== "object") active.zones = {};

  const normalized: Record<string, T[]> = {};
  for (const z of zones) {
    const arr = active.zones[z.name];
    normalized[z.name] = Array.isArray(arr) ? arr : [];
  }
  active.zones = normalized;
}
