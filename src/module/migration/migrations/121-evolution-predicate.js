import { MigrationBase } from "../base.js";
import { sluggify } from "../../../util/misc.js";

/**
 * Convert the legacy evolution data format to the new predicate-based format.
 *
 * Before:
 *   { level: 10, slug: "...", uuid: "...", other: { restrictions: ["Female"], evolutionItem: { slug: "...", uuid: "..." } } }
 *
 * After:
 *   { slug: "...", uuid: "...", other: { predicate: ["self:level:10+", "self:gender:female", "item:..."] } }
 */
function migrateEvolution(evolution) {
  // Already migrated: has predicate, no top-level level field, no restrictions
  if (
    Array.isArray(evolution.other?.predicate) &&
    !("level" in evolution) &&
    !("restrictions" in (evolution.other ?? {}))
  ) {
    return evolution;
  }

  const predicate = [];

  // Level → self:level:N+
  const level = typeof evolution.level === "number" && !isNaN(evolution.level) ? evolution.level : 1;
  if (level > 1) predicate.push(`self:level:${level}+`);

  // Restrictions → gender predicates
  for (const restriction of (evolution.other?.restrictions ?? [])) {
    const lower = String(restriction ?? "").trim().toLowerCase();
    if (!lower) continue;
    if (lower === "female" || lower === "male") {
      predicate.push(`self:gender:${lower}`);
    }
    // Unknown restrictions are dropped — they should be re-entered manually as custom predicates.
  }

  // evolutionItem → item:slug
  const evoItem = evolution.other?.evolutionItem;
  if (evoItem) {
    const itemSlug = sluggify(evoItem.slug ?? evoItem.name ?? "");
    if (itemSlug) {
      predicate.push(`item:${itemSlug}`);
    }
  }

  return {
    uuid: evolution.uuid,
    slug: evolution.slug,
    other: { predicate },
  };
}

export class Migration121EvolutionPredicate extends MigrationBase {
  static version = 0.121;

  async updateItem(source) {
    if (source.type !== "species") return;
    if (!Array.isArray(source.system?.evolutions)) return;

    source.system.evolutions = source.system.evolutions.map(migrateEvolution);
  }
}
