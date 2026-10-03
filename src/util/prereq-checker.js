/**
 * Prerequisite checking utilities shared between the Trainer Level-Up wizard
 * and potentially other consumers.
 *
 * The NPC Quick Build has a more complex async version that can resolve and
 * acquire prerequisite items from the compendium. This version is synchronous
 * and only checks what the actor ALREADY HAS.
 */

// ─── Regex constants ─────────────────────────────────────────────────────────
// NOTE: Do NOT use /g flag on these — they are NOT safe to call async with /g.

const SINGLE_MIN_SKILL_RANK_RE = /(?<rank>(Pathetic)|(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso)) (?<skill>.+)/i;
const ANY_N_SKILLS_AT_RE = /(any )?(?<n>([0-9]+)|(A)|(One)|(Two)|(Three)|(Four)|(Five)|(Six)|(Seven)|(Eight)|(Nine)) Skills? at (?<rank>(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso))( Rank)?/i;
const N_SKILLS_AT_FROM_LIST_RE = /(?<n>([0-9]+)|(A)|(One)|(Two)|(Three)|(Four)|(Five)|(Six)|(Seven)|(Eight)|(Nine))( Skills?)? of (?<skills>.+) at (?<rank>(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso))( Rank)?( or higher)?/i;
const CATEGORY_SKILL_RE = /An? (?<category>[A-Za-z][A-Za-z-]*) Skills? at (?<rank>(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso))( Rank)?\.?$/i;
const FEAT_WITH_SUB_RE = /(?<main>[^\(\)]+) (\((?<sub>.+)\)) ?(?<cr>\[CR\])?/i;
const N_FEATS_FROM_LIST_RE = /(?<n>([0-9]+)|(A)|(One)|(Two)|(Three)|(Four)|(Five)|(Six)|(Seven)|(Eight)|(Nine)) of (?<features>.+)?/i;
const LEVEL_RE = /Level (?<lv>[0-9]+)/i;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison: lowercased and with common alternative
 * phrasings replaced by their canonical skill/item names.
 */
export function simplifyString(s) {
    const replacements = {
        "pokémon": "pokemon",
        "general education": "general",
        "tech education": "technology",
        "technology education": "technology",
        "medicine education": "medicine",
        "medicine edu": "medicine",
        "pokemon education": "pokemon",
        "occult education": "occult",
        "intimidation": "intimidate",
    };
    return Object.keys(replacements).reduce(
        (a, b) => a?.replaceAll(b, replacements[b]),
        s?.toLowerCase()
    );
}

function parseIntA(s) {
    const i = parseInt(s);
    if (!Number.isNaN(i)) return i;
    if (s.toLowerCase() === "a") return 1;
    const idx = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
        .indexOf(s.toLowerCase());
    return idx >= 0 ? idx : Number.NaN;
}

/**
 * Resolve a human-readable skill name (e.g. "Expert Combat", "General Education")
 * to a skill key (e.g. "combat", "generalEd") using the game's i18n strings.
 * Returns undefined if not found.
 */
function getSkillKey(name) {
    return CONFIG.PTU.data.skills.keys.find(
        k => simplifyString(name) === simplifyString(game.i18n.format(`SKILL.${k}`))
    );
}

// ─── Rank number lookup ───────────────────────────────────────────────────────

const RANK_SLUG_TO_NUM = {
    pathetic: 1,
    untrained: 2,
    novice: 3,
    adept: 4,
    expert: 5,
    master: 6,
    virtuoso: 8,
};

function rankNameToNum(rankName) {
    return RANK_SLUG_TO_NUM[rankName.toLowerCase()] ?? 0;
}

// ─── Actor context ────────────────────────────────────────────────────────────

/**
 * Build a lookup context from an actor for fast prerequisite checking.
 * @param {Actor} actor
 * @returns {{ level: number, itemNames: Set<string>, itemSlugs: Set<string>, skills: Record<string, number> }}
 */
export function buildActorPrereqContext(actor) {
    const items = actor.items.contents;
    const itemNames = new Set(items.map(i => simplifyString(i.name)));
    // Build a set that also includes base names with parentheticals stripped.
    // This lets a prereq like "Elemental Connection" match an actor's
    // "Elemental Connection (Fairy)" item.
    const itemBaseNames = new Set(itemNames);
    for (const name of itemNames) {
        const base = name?.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (base && base !== name) itemBaseNames.add(base);
    }
    return {
        level: actor.system.level.current ?? 1,
        itemNames,
        itemBaseNames,
        itemSlugs: new Set(items.map(i => i.system?.slug?.toLowerCase()).filter(Boolean)),
        skills: Object.fromEntries(
            Object.entries(actor.system.skills ?? {}).map(
                ([key, skill]) => [key, skill.value?.total ?? skill.value?.value ?? 1]
            )
        ),
    };
}

// ─── Core check ──────────────────────────────────────────────────────────────

/**
 * Check a single prerequisite text string against the actor context.
 * Returns true if the prerequisite is met (or unknown/unrecognised = assume met).
 *
 * @param {string} text  The prerequisite label string
 * @param {{ level, itemNames, itemSlugs, skills }} ctx
 * @returns {boolean}
 */
function checkSinglePrereq(text, ctx) {
    text = text?.trim() ?? '';
    if (!text) return true;

    // Strip parenthesized sub-selection from the main prereq name for name matching
    const withSub = text.match(FEAT_WITH_SUB_RE);
    const mainText = withSub?.groups?.sub ? withSub.groups.main.trim() : text;

    // GM Permission is always considered met
    if (text.toLowerCase() === 'gm permission') return true;

    // Level X
    const levelMatch = mainText.match(LEVEL_RE);
    if (levelMatch) return ctx.level >= parseInt(levelMatch.groups.lv);

    // Single minimum skill rank: "Expert Combat"
    const skillMatch = mainText.match(SINGLE_MIN_SKILL_RANK_RE);
    if (skillMatch) {
        const rankNeeded = rankNameToNum(skillMatch.groups.rank);
        const skillKey = getSkillKey(skillMatch.groups.skill);
        if (rankNeeded && skillKey) {
            return (ctx.skills[skillKey] ?? 1) >= rankNeeded;
        }
    }

    // "Any N Skills at RANK"
    const anyNSkillsMatch = mainText.match(ANY_N_SKILLS_AT_RE);
    if (anyNSkillsMatch) {
        const rankNeeded = rankNameToNum(anyNSkillsMatch.groups.rank);
        const n = parseIntA(anyNSkillsMatch.groups.n ?? "100");
        if (rankNeeded && n) {
            const qualifyingCount = CONFIG.PTU.data.skills.keys
                .filter(k => (ctx.skills[k] ?? 1) >= rankNeeded).length;
            return qualifyingCount >= n;
        }
    }

    // "N of SKILLS at RANK (or higher)"
    const nOfSkillsMatch = mainText.match(N_SKILLS_AT_FROM_LIST_RE);
    if (nOfSkillsMatch) {
        const rankNeeded = rankNameToNum(nOfSkillsMatch.groups.rank);
        const n = parseIntA(nOfSkillsMatch.groups.n ?? "100");
        const skillNames = nOfSkillsMatch.groups.skills.split(/ or /gi);
        if (rankNeeded && n) {
            const qualifyingCount = skillNames
                .map(getSkillKey)
                .filter(k => k && (ctx.skills[k] ?? 1) >= rankNeeded).length;
            return qualifyingCount >= n;
        }
    }

    // "An X Skill at Rank" / "a X Skill at Rank" – a named category of skills
    const categorySkillMatch = mainText.match(CATEGORY_SKILL_RE);
    if (categorySkillMatch) {
        const rankNeeded = rankNameToNum(categorySkillMatch.groups.rank);
        const category = categorySkillMatch.groups.category.toLowerCase();
        if (rankNeeded) {
            // Find skills whose i18n label contains the category keyword
            const categoryKeys = CONFIG.PTU.data.skills.keys.filter(k =>
                game.i18n.format(`SKILL.${k}`).toLowerCase().includes(category)
            );
            if (categoryKeys.length) {
                return categoryKeys.some(k => (ctx.skills[k] ?? 1) >= rankNeeded);
            }
            // Unknown category – assume met (cannot verify)
            return true;
        }
    }

    // "N of FEAT1 or FEAT2 or ..." – need at least N of these items
    const nFeatsOfMatch = mainText.match(N_FEATS_FROM_LIST_RE);
    if (nFeatsOfMatch) {
        const n = parseIntA(nFeatsOfMatch.groups.n ?? "100");
        const names = (nFeatsOfMatch.groups.features ?? '').split(/ or /gi)
            .map(s => simplifyString(s.trim()))
            .filter(Boolean);
        if (!Number.isNaN(n) && names.length) {
            const ownedCount = names.filter(name => ctx.itemNames.has(name) || ctx.itemSlugs.has(name)).length;
            return ownedCount >= n;
        }
    }

    // OR clause – recursively check each term
    if ((/ or /i).test(text)) {
        return text.split(/ or /i).some(term => checkSinglePrereq(term.trim(), ctx));
    }

    // Item name / slug check
    const simplified = simplifyString(mainText);
    if (withSub?.groups?.sub) {
        // Prereq specifies a particular variant (e.g., "Elemental Connection (Fairy)").
        // Check the full text with the parenthetical, since that is the actual item name.
        const fullSimplified = simplifyString(text);
        if (ctx.itemNames.has(fullSimplified) || ctx.itemSlugs.has(simplified)) return true;
    } else {
        // No specific variant – also accept items whose base name matches
        // (e.g., "Elemental Connection" matches "Elemental Connection (Fairy)").
        const baseNames = ctx.itemBaseNames ?? ctx.itemNames;
        if (baseNames.has(simplified) || ctx.itemSlugs.has(simplified)) return true;
    }

    // Unrecognised prerequisite – assume NOT met (conservative)
    return false;
}

/**
 * Check all prerequisites of a compendium browser item entry against an actor.
 *
 * The compendium browser moves the class prerequisite out of `prerequisites`
 * and into `item.class` (sluggified). This function checks both.
 *
 * @param {Object} item  Compendium browser entry with `prerequisites: [{label, tier}]`
 *                       and optional `class: string`
 * @param {Actor}  actor
 * @returns {boolean}  True if all prerequisites are met (or there are none)
 */
export function meetsPrereqsForActor(item, actor) {
    const ctx = buildActorPrereqContext(actor);
    return meetsPrereqsWithContext(item, ctx);
}

/**
 * Like meetsPrereqsForActor but uses a pre-built context (faster for bulk checking).
 */
export function meetsPrereqsWithContext(item, ctx) {
    // The compendium browser moves class prerequisites out of item.prerequisites
    // and into item.class (sluggified). However, for CLASS feats themselves
    // (keywords includes "Class"), item.class is the name of what they ARE —
    // not a prerequisite. Only check item.class as a prereq for non-class feats.
    if (item.class && !item.keywords?.includes("Class")) {
        if (!ctx.itemNames.has(item.class) && !ctx.itemSlugs.has(item.class)) {
            return false;
        }
    }

    if (!item.prerequisites?.length) return true;
    return item.prerequisites.every(prereq => checkSinglePrereq(prereq.label ?? '', ctx));
}
