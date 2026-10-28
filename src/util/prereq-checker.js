/**
 * Prerequisite checking utilities shared between the Trainer Level-Up wizard
 * and potentially other consumers.
 *
 * The NPC Quick Build has a more complex async version that can resolve and
 * acquire prerequisite items from the compendium. This version is synchronous
 * and only checks what the actor ALREADY HAS.
 */
import { sluggify } from "./misc.js";

// ─── Regex constants ─────────────────────────────────────────────────────────
// NOTE: Do NOT use /g flag on these — they are NOT safe to call async with /g.

const SINGLE_MIN_SKILL_RANK_RE = /(?<rank>(Pathetic)|(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso)) (?<skill>.+)/i;
const ANY_N_SKILLS_AT_RE = /(any )?(?<n>([0-9]+)|(A)|(One)|(Two)|(Three)|(Four)|(Five)|(Six)|(Seven)|(Eight)|(Nine)) Skills? at (?<rank>(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso))( Rank)?/i;
const N_SKILLS_AT_FROM_LIST_RE = /(?<n>([0-9]+)|(A)|(One)|(Two)|(Three)|(Four)|(Five)|(Six)|(Seven)|(Eight)|(Nine))( Skills?)? of (?<skills>.+) at (?<rank>(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso))( Rank)?( or higher)?/i;
const CATEGORY_SKILL_RE = /An? (?<category>[A-Za-z][A-Za-z-]*) Skills? at (?<rank>(Untrained)|(Novice)|(Adept)|(Expert)|(Master)|(Virtuoso))( Rank)?\.?$/i;
const FEAT_WITH_SUB_RE = /(?<main>[^\(\)]+) (\((?<sub>.+)\)) ?(?<cr>\[CR\])?/i;
const N_FEATS_FROM_LIST_RE = /(?<n>([0-9]+)|(A)|(One)|(Two)|(Three)|(Four)|(Five)|(Six)|(Seven)|(Eight)|(Nine)) of (?<features>.+)?/i;
const LEVEL_RE = /Level (?<lv>[0-9]+)/i;
const TYPE_LINKED_CLASS_RE = /^A (?:(?<type>[A-Za-z]+)-)?Type-Linked Class$/i;
// "All A or B options" – the meta-line that triggers grouped prerequisite evaluation
const ALL_OPTIONS_RE = /^All [A-Z](?: or [A-Z])+ options$/i;
// "A: something" or "B: something" – a member of a named option group
const GROUP_MEMBER_RE = /^([A-Z]):\s*(.+)$/i;
// "N [Different] TYPE Type Pokemon" e.g. "2 Different Dark Type Pokemon"
const TYPED_POKEMON_RE = /^(?<n>[0-9]+|A|One|Two|Three|Four|Five|Six|Seven|Eight|Nine) (?:Different )?(?<type>[A-Za-z]+) Type Pok[e\u00e9]mon$/i;
// "N Pokemon with STAT of AMOUNT" e.g. "1 Pokémon with Attack of 110"
const POKEMON_STAT_RE = /^(?<n>[0-9]+|A|One|Two|Three|Four|Five|Six|Seven|Eight|Nine) Pok[e\u00e9]mon with (?<stat>.+?) (?:of|at) (?<amount>[0-9]+)(?:\s+(?:or\s+)?(?:more|higher))?$/i;
// "N CLASS Features" e.g. "4 Skirmisher Features" or "4 Type Ace (Fire) Features"
const CLASS_FEATURES_RE = /^(?<n>[0-9]+|A|One|Two|Three|Four|Five|Six|Seven|Eight|Nine) (?<class>.+?) Features?$/i;
// "N Friendship X Pokemon" e.g. "Three Friendship 4 Pokemon"
const POKEMON_FRIENDSHIP_RE = /^(?<n>[0-9]+|A|One|Two|Three|Four|Five|Six|Seven|Eight|Nine) Friendship (?<amount>[0-9]+) Pok[e\u00e9]mon$/i;
// "[at least] N Feature(s) with the [KEYWORD] tag" e.g. "Two Features with the [Orders] tag"
const KEYWORD_FEATURES_RE = /^(?:at least )?(?<n>[0-9]+|A|One|Two|Three|Four|Five|Six|Seven|Eight|Nine) Features? with the \[(?<keyword>[^\]]+)\] (tag|keyword)$/i;

// Maps human-readable stat names to actor.system.stats keys
const STAT_NAME_MAP = {
    hp: 'hp',
    attack: 'atk',
    defense: 'def',
    'special attack': 'spatk',
    'special defense': 'spdef',
    'sp. atk': 'spatk',
    'sp. def': 'spdef',
    'sp atk': 'spatk',
    'sp def': 'spdef',
    speed: 'spd',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a string for comparison: lowercased and with common alternative
 * phrasings replaced by their canonical skill/item names.
 */
export function simplifyString(s) {
    const replacements = {
        "pokémon": "pokemon",
        "general education": "generalEd",
        "tech education": "techEd",
        "technology education": "techEd",
        "medicine education": "medicineEd",
        "medicine edu": "medicineEd",
        "pokemon education": "pokemonEd",
        "occult education": "occultEd",
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
    // Build a set of sluggified item names (and their parenthetical-stripped bases).
    // This lets item.class (a slug from the compendium browser) match an actor item
    // whose system.slug differs (e.g. "type-ace-bug-cr" for "Type Ace (Bug)").
    const itemNameSlugs = new Set();
    for (const item of items) {
        const nameSlug = sluggify(item.name);
        if (nameSlug) itemNameSlugs.add(nameSlug);
        const baseName = item.name?.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (baseName && baseName !== item.name) {
            const baseSlug = sluggify(baseName);
            if (baseSlug) itemNameSlugs.add(baseSlug);
        }
    }
    // Collect "Type Linked" and "Type Linked (Water)" etc. from owned class items.
    const typeLinkedKeywords = new Set();
    for (const item of items) {
        for (const kw of (item.system?.keywords ?? [])) {
            if (/^Type Linked/i.test(kw)) typeLinkedKeywords.add(kw.toLowerCase());
        }
    }
    // Count owned feats/features by class for "N Class Features" prerequisites.
    const featuresByClass = {};
    // Count owned feats/features by keyword for "N Features with the [KEYWORD] tag" prerequisites.
    const featuresByKeyword = {};
    for (const item of items) {
        const cls = item.system?.class?.trim();
        if (cls) {
            const key = cls.toLowerCase();
            featuresByClass[key] = (featuresByClass[key] ?? 0) + 1;
        }
        for (const kw of (item.system?.keywords ?? [])) {
            const key = kw.toLowerCase();
            featuresByKeyword[key] = (featuresByKeyword[key] ?? 0) + 1;
        }
    }
    // Count Pokémon of each type belonging to this trainer (including boxed).
    // Also collect stat totals and friendship values for each Pokémon.
    const typedPokemonCounts = new Map();
    const pokemonStatTotals = {}; // { statKey: number[] }
    const pokemonFriendships = []; // friendship value for each trainer pokémon
    if (typeof game !== 'undefined' && game?.actors && actor.id) {
        for (const pokemon of game.actors) {
            if (pokemon.flags?.ptu?.party?.trainer !== actor.id) continue;
            for (const type of (pokemon.system?.typing ?? [])) {
                const t = type.toLowerCase();
                typedPokemonCounts.set(t, (typedPokemonCounts.get(t) ?? 0) + 1);
            }
            const stats = pokemon.system?.stats ?? {};
            for (const [key, statData] of Object.entries(stats)) {
                const total = statData?.total;
                if (typeof total === 'number') {
                    (pokemonStatTotals[key] ??= []).push(total);
                }
            }
            const friendship = pokemon.system?.friendship;
            if (typeof friendship === 'number') pokemonFriendships.push(friendship);
        }
    }
    return {
        level: actor.system.level.current ?? 1,
        itemNames,
        itemBaseNames,
        itemNameSlugs,
        typeLinkedKeywords,
        typedPokemonCounts,
        pokemonStatTotals,
        pokemonFriendships,
        featuresByClass,
        featuresByKeyword,
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
export function checkSinglePrereq(text, ctx, testDict={}) {
    text = text?.trim() ?? '';
    if (!text) return true;

    // "All A or B options" is a meta-line evaluated at the list level – not a real check
    if (ALL_OPTIONS_RE.test(text)) return true;
    // "A: something" / "B: something" – strip the group prefix and check the actual prereq
    const groupedPrefixMatch = text.match(GROUP_MEMBER_RE);
    if (groupedPrefixMatch) return checkSinglePrereq(groupedPrefixMatch[2].trim(), ctx, testDict);

    // check "does not have X"
    if (text.toLowerCase().startsWith("does not have ")) {
        const itemName = text.slice("does not have ".length).trim();
        return !checkSinglePrereq(itemName, ctx, testDict);
    }

    // Strip parenthesized sub-selection from the main prereq name for name matching
    const withSub = text.match(FEAT_WITH_SUB_RE);
    const mainText = withSub?.groups?.sub ? withSub.groups.main.trim() : text;

    // GM Permission is always considered met *for the GM*
    if (text.toLowerCase() === 'gm permission') return game.user.isGM;

    // Level X
    const levelMatch = mainText.match(LEVEL_RE);
    if (levelMatch) return ctx.level >= parseInt(levelMatch.groups.lv);

    // Single minimum skill rank: "Expert Combat" or "Novice Survival or Stealth"
    const skillMatch = mainText.match(SINGLE_MIN_SKILL_RANK_RE);
    if (skillMatch) {
        const rankNeeded = rankNameToNum(skillMatch.groups.rank);
        const skillKey = getSkillKey(skillMatch.groups.skill);
        if (rankNeeded && skillKey) {
            return (ctx.skills[skillKey] ?? 1) >= rankNeeded;
        }
        if (rankNeeded && skillMatch.groups.skill.toLowerCase().includes(" or ")) {
            const rankPrefix = new RegExp(`^${skillMatch.groups.rank}\\s+`, 'i');
            const skillKeys = skillMatch.groups.skill.split(/( or )|(, (or)?)/gi)
                .map(s => getSkillKey(s?.replace(rankPrefix, '')))
                .filter(Boolean);
            if (skillKeys.length > 0) {
                return skillKeys.some(k => (ctx.skills[k] ?? 1) >= rankNeeded);
            }
            // No recognisable skill names found — fall through to other patterns
        }
        if (rankNeeded && skillMatch.groups.skill.toLowerCase().includes(" and ")) {
            const rankPrefix = new RegExp(`^${skillMatch.groups.rank}\\s+`, 'i');
            const skillKeys = skillMatch.groups.skill.split(/( and )|(, (and)?)/gi)
                .map(s => getSkillKey(s?.replace(rankPrefix, '')))
                .filter(Boolean);
            if (skillKeys.length > 0) {
                return skillKeys.every(k => (ctx.skills[k] ?? 1) >= rankNeeded);
            }
            // No recognisable skill names found — fall through to other patterns
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

    // "A Type-Linked Class" / "A Fire-Type-Linked Class"
    const typeLinkedMatch = text.match(TYPE_LINKED_CLASS_RE);
    if (typeLinkedMatch) {
        const type = typeLinkedMatch.groups.type; // e.g. "Water", or undefined
        if (!type) {
            // Any Type Linked class satisfies this
            return (ctx.typeLinkedKeywords?.size ?? 0) > 0;
        }
        // Specific type: "A Water-Type-Linked Class" → keyword "type linked (water)"
        return ctx.typeLinkedKeywords?.has(`type linked (${type.toLowerCase()})`) ?? false;
    }

    // "N [Different] TYPE Type Pokemon" e.g. "2 Different Dark Type Pokemon"
    const typedPokemonMatch = text.match(TYPED_POKEMON_RE);
    if (typedPokemonMatch) {
        const n = parseIntA(typedPokemonMatch.groups.n);
        const type = typedPokemonMatch.groups.type.toLowerCase();
        const count = ctx.typedPokemonCounts?.get(type) ?? 0;
        return !Number.isNaN(n) && count >= n;
    }

    // "N Friendship X Pokemon" e.g. "Three Friendship 4 Pokemon"
    const friendshipMatch = text.match(POKEMON_FRIENDSHIP_RE);
    if (friendshipMatch) {
        const n = parseIntA(friendshipMatch.groups.n);
        const amount = parseInt(friendshipMatch.groups.amount);
        const friendships = ctx.pokemonFriendships ?? [];
        const qualifying = friendships.filter(f => f >= amount).length;
        return !Number.isNaN(n) && !Number.isNaN(amount) && qualifying >= n;
    }

    // "[at least] N Feature(s) with the [KEYWORD] tag" e.g. "Two Features with the [Orders] tag"
    const keywordFeatMatch = text.match(KEYWORD_FEATURES_RE);
    if (keywordFeatMatch) {
        const n = parseIntA(keywordFeatMatch.groups.n);
        const keyword = keywordFeatMatch.groups.keyword.trim().toLowerCase();
        const count = ctx.featuresByKeyword?.[keyword] ?? 0;
        return !Number.isNaN(n) && count >= n;
    }

    // "N Pokemon with STAT of AMOUNT" e.g. "1 Pokémon with Attack of 110"
    const pokemonStatMatch = text.match(POKEMON_STAT_RE);
    if (pokemonStatMatch) {
        const n = parseIntA(pokemonStatMatch.groups.n);
        const statKey = STAT_NAME_MAP[pokemonStatMatch.groups.stat.trim().toLowerCase()];
        const amount = parseInt(pokemonStatMatch.groups.amount);
        if (!Number.isNaN(n) && statKey && !Number.isNaN(amount)) {
            const totals = ctx.pokemonStatTotals?.[statKey] ?? [];
            const qualifying = totals.filter(v => v >= amount).length;
            return qualifying >= n;
        }
        // Unknown stat name, fall through
    }

    // "N CLASS Features" e.g. "4 Skirmisher Features" or "4 Type Ace (Fire) Features"
    const classFeaturesMatch = text.match(CLASS_FEATURES_RE);
    if (classFeaturesMatch) {
        const n = parseIntA(classFeaturesMatch.groups.n);
        const cls = classFeaturesMatch.groups.class.trim().toLowerCase();
        const fbClass = ctx.featuresByClass ?? {};
        // Count features for this exact class name
        let count = fbClass[cls] ?? 0;
        // If the class name has a parenthetical (e.g. "type ace (fire)"),
        // also count features of the stripped base class ("type ace").
        const baseClass = cls.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (baseClass !== cls) count += fbClass[baseClass] ?? 0;
        return !Number.isNaN(n) && count >= n;
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

    testDict.fail = true;

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
        // item.class is a slug (e.g. "type-ace" or "type-ace-bug"). Check against:
        //  - itemSlugs: system.slug values on owned items
        //  - itemNameSlugs: sluggify(item.name) for owned items, plus sluggified
        //    base names (parenthetical stripped) so owning "Type Ace (Bug)" matches
        //    both class slug "type-ace-bug" AND base class slug "type-ace".
        if (!ctx.itemNames.has(item.class) && !ctx.itemSlugs.has(item.class)
            && !ctx.itemNameSlugs?.has(item.class)) {
            return false;
        }
    }

    if (!item.prerequisites?.length) return true;

    const prereqLabels = item.prerequisites.map(p => p.label ?? '');

    // "All A or B options" grouped logic: either all A-prefixed OR all B-prefixed must pass
    if (prereqLabels.some(l => ALL_OPTIONS_RE.test(l))) {
        const groups = {};
        const ungrouped = [];
        for (const label of prereqLabels) {
            if (ALL_OPTIONS_RE.test(label)) continue; // skip the meta-line itself
            const m = label.match(GROUP_MEMBER_RE);
            if (m) {
                const key = m[1].toUpperCase();
                (groups[key] ??= []).push(m[2].trim());
            } else {
                ungrouped.push(label);
            }
        }
        // All non-grouped prerequisites must pass regardless
        if (!ungrouped.every(l => checkSinglePrereq(l, ctx))) return false;
        // At least one option group must have every one of its prerequisites pass
        const groupKeys = Object.keys(groups);
        return groupKeys.length === 0
            || groupKeys.some(key => groups[key].every(l => checkSinglePrereq(l, ctx)));
    }

    return prereqLabels.every(label => checkSinglePrereq(label, ctx));
}
