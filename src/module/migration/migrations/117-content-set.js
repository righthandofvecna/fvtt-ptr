import { MigrationBase } from "../base.js";

/**
 * Maps the bracket suffixes found in item names to their content set keys.
 * Ordered from most-specific to least-specific to avoid partial matches.
 */
const SUFFIX_MAP = [
    { pattern: /\s*\[F&S Playtest\]\s*$/i,    contentSet: "friendship-spirit" },
    { pattern: /\s*\[F&S\]\s*$/i,             contentSet: "friendship-spirit" },
    { pattern: /\s*\[Weather Playtest\]\s*$/i, contentSet: "weather-playtest" },
    { pattern: /\s*\[WP\]\s*$/i,              contentSet: "weather-playtest" },
    { pattern: /\s*\[Class Rework\]\s*$/i,    contentSet: "class-rework" },
    { pattern: /\s*\[CR\]\s*$/i,              contentSet: "class-rework" },
];

const AFFECTED_TYPES = ["feat", "move", "ability", "contestmove", "edge", "pokeedge", "capability", "item", "spiritaction", "effect", "reference"];

/**
 * Detects a content set suffix in a string and returns the clean name + matched key.
 * @param {string} str
 * @returns {{ clean: string, contentSet: string } | null}
 */
function detectSuffix(str) {
    if (!str || typeof str !== "string") return null;
    for (const { pattern, contentSet } of SUFFIX_MAP) {
        if (pattern.test(str)) {
            return { clean: str.replace(pattern, "").trim(), contentSet };
        }
    }
    return null;
}

export class Migration117ContentSet extends MigrationBase {
    static version = 0.117;

    async updateItem(source) {
        if (!AFFECTED_TYPES.includes(source.type)) return;
        if (!source.system) return;

        // Skip items that already have a contentSet explicitly set
        if (source.system.contentSet) return;

        // Detect suffix in item name
        const nameResult = detectSuffix(source.name);
        if (nameResult) {
            source.name = nameResult.clean;
            source.system.contentSet = nameResult.contentSet;
        } else {
            // No suffix — ensure the field exists with default value
            source.system.contentSet ??= "";
        }

        // Ensure replacesSlug field exists
        source.system.replacesSlug ??= "";

        // For Feats: also strip suffix from system.class
        if (source.type === "feat" && source.system.class) {
            const classResult = detectSuffix(source.system.class);
            if (classResult) {
                source.system.class = classResult.clean;
            }
        }
    }
}
