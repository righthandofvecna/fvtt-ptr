/**
 * Tests for checkSinglePrereq in src/util/prereq-checker.js.
 *
 * These tests construct a minimal context object manually so no live actor is
 * required.  The rank number map used internally is:
 *   Pathetic=1, Untrained=2, Novice=3, Adept=4, Expert=5, Master=6, Virtuoso=8
 */
import { TestRegistry } from "../registry.js";
import { assert, assertEqual } from "../helpers/index.js";
import { checkSinglePrereq, simplifyString, meetsPrereqsWithContext } from "../../util/prereq-checker.js";
import { sluggify } from "../../util/misc.js";

const CATEGORY = "prerequisites";

// ─── Context helpers ──────────────────────────────────────────────────────────

/**
 * Build a minimal prereq context.
 * @param {{ level?: number, skills?: Record<string, number>, itemNames?: string[], itemSlugs?: string[] }} opts
 */
function makeCtx({ level = 10, skills = {}, itemNames = [], itemSlugs = [], typeLinkedKeywords = [], typedPokemonCounts = {}, pokemonStatTotals = {}, pokemonFriendships = [], featuresByClass = {} } = {}) {
    const simplified = itemNames.map(n => simplifyString(n));
    const baseNames = new Set(simplified);
    const itemNameSlugs = new Set();
    for (const name of itemNames) {
        const simpleName = simplifyString(name);
        const base = simpleName?.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (base && base !== simpleName) baseNames.add(base);
        const nameSlug = sluggify(name);
        if (nameSlug) itemNameSlugs.add(nameSlug);
        const baseName = name?.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (baseName && baseName !== name) {
            const baseSlug = sluggify(baseName);
            if (baseSlug) itemNameSlugs.add(baseSlug);
        }
    }
    // Convert plain object to Map for typedPokemonCounts
    const typedPokemonCountsMap = new Map(
        Object.entries(typedPokemonCounts).map(([k, v]) => [k.toLowerCase(), v])
    );
    // Lowercase all class keys in featuresByClass
    const fbClass = Object.fromEntries(
        Object.entries(featuresByClass).map(([k, v]) => [k.toLowerCase(), v])
    );
    return {
        level,
        itemNames: new Set(simplified),
        itemBaseNames: baseNames,
        itemNameSlugs,
        typeLinkedKeywords: new Set(typeLinkedKeywords.map(k => k.toLowerCase())),
        typedPokemonCounts: typedPokemonCountsMap,
        pokemonStatTotals,
        pokemonFriendships,
        featuresByClass: fbClass,
        itemSlugs: new Set(itemSlugs),
        skills,
    };
}

// ─── Empty / trivial ─────────────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | Empty string is always met", () => {
    assert(checkSinglePrereq("", makeCtx()), "Empty prerequisite should always pass");
    assert(checkSinglePrereq(null, makeCtx()), "Null prerequisite should always pass");
});

TestRegistry.register(CATEGORY, "Prereq | Unrecognised text returns false", () => {
    assert(
        !checkSinglePrereq("Xyzzy Frobozz Zorkmid", makeCtx()),
        "Unrecognised prerequisite should return false"
    );
});

// ─── Level checks ─────────────────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | Level X met when actor level >= X", () => {
    const ctx = makeCtx({ level: 10 });
    assert(checkSinglePrereq("Level 10", ctx), "Level 10 should be met at level 10");
    assert(checkSinglePrereq("Level 5", ctx), "Level 5 should be met at level 10");
    assert(!checkSinglePrereq("Level 11", ctx), "Level 11 should not be met at level 10");
});

// ─── Single skill rank ────────────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | Single skill rank met when skill value >= rank", () => {
    const ctx = makeCtx({ skills: { intuition: 6, combat: 4 } });
    assert(checkSinglePrereq("Master Intuition", ctx), "Master Intuition should be met at rank 6");
    assert(!checkSinglePrereq("Expert Combat", ctx), "Expert Combat should NOT be met when combat=4 < 5");
    assert(checkSinglePrereq("Adept Combat", ctx), "Adept Combat (4) should be met when combat=4");
});

TestRegistry.register(CATEGORY, "Prereq | Master Pokémon Education met when pokemonEd=6", () => {
    const ctx = makeCtx({ skills: { pokemonEd: 6 } });
    assert(checkSinglePrereq("Master Pokémon Education", ctx), "Master Pokémon Education should be met at rank 6");
});

// ─── OR skill prerequisites (regression for rank-prefix stripping bug) ────────

TestRegistry.register(
    CATEGORY,
    "Prereq | 'Master Intuition or Master Pokémon Education' met when only intuition is Master",
    () => {
        const ctx = makeCtx({ skills: { intuition: 6, pokemonEd: 3 } });
        assert(
            checkSinglePrereq("Master Intuition or Master Pokémon Education", ctx),
            "OR prereq should be met when intuition=6 (Master)"
        );
    },
    { description: "Regression: rank prefix was not stripped from the second OR term." }
);

TestRegistry.register(
    CATEGORY,
    "Prereq | 'Master Intuition or Master Pokémon Education' met when only pokémonEd is Master",
    () => {
        const ctx = makeCtx({ skills: { intuition: 3, pokemonEd: 6 } });
        assert(
            checkSinglePrereq("Master Intuition or Master Pokémon Education", ctx),
            "OR prereq should be met when pokemonEd=6 (Master)"
        );
    },
    { description: "Regression: 'Master Pokémon Education' as second OR term was silently dropped." }
);

TestRegistry.register(
    CATEGORY,
    "Prereq | 'Master Intuition or Master Pokémon Education' NOT met when neither is Master",
    () => {
        const ctx = makeCtx({ skills: { intuition: 5, pokemonEd: 5 } });
        assert(
            !checkSinglePrereq("Master Intuition or Master Pokémon Education", ctx),
            "OR prereq should NOT be met when both skills are only Expert (5)"
        );
    }
);

// ─── AND skill prerequisites ──────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | Skill AND requires all skills to meet rank", () => {
    const ctxBoth = makeCtx({ skills: { intuition: 6, combat: 6 } });
    const ctxOne  = makeCtx({ skills: { intuition: 6, combat: 3 } });
    assert(
        checkSinglePrereq("Master Intuition and Master Combat", ctxBoth),
        "AND prereq met when both skills are Master"
    );
    assert(
        !checkSinglePrereq("Master Intuition and Master Combat", ctxOne),
        "AND prereq NOT met when one skill is below Master"
    );
});

// ─── "Any N Skills at RANK" ───────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | 'Any N Skills at RANK' counts all qualifying skills", () => {
    // Give 3 skills at Master (6) and 2 at lower ranks
    const ctx = makeCtx({
        skills: { intuition: 6, combat: 6, athletics: 6, stealth: 4, survival: 3 }
    });
    assert(checkSinglePrereq("3 Skills at Master", ctx), "3 Skills at Master: met with 3 master skills");
    assert(checkSinglePrereq("Any 2 Skills at Master", ctx), "Any 2 Skills at Master: met with 3 master skills");
    assert(!checkSinglePrereq("4 Skills at Master", ctx), "4 Skills at Master: NOT met with only 3 master skills");
    assert(checkSinglePrereq("One Skill at Master", ctx), "One Skill at Master: met with 3 master skills");
});

// ─── Multi-skill OR with same rank (real game format) ────────────────────────

TestRegistry.register(
    CATEGORY,
    "Prereq | 'Adept Command or Guile or Pokémon Education' matches any at rank",
    () => {
        const onlyGuile  = makeCtx({ skills: { command: 2, guile: 4, pokemonEd: 2 } });
        const onlyPokEd  = makeCtx({ skills: { command: 2, guile: 2, pokemonEd: 4 } });
        const noneAdept  = makeCtx({ skills: { command: 2, guile: 3, pokemonEd: 2 } });

        assert(checkSinglePrereq("Adept Command or Guile or Pokémon Education", onlyGuile), "Met via Guile=4");
        assert(checkSinglePrereq("Adept Command or Guile or Pokémon Education", onlyPokEd), "Met via pokemonEd=4");
        assert(!checkSinglePrereq("Adept Command or Guile or Pokémon Education", noneAdept), "Not met (none at Adept)");
    },
    { description: "Real game format: 'Adept X or Y or Z' — all share the same rank." }
);

// ─── "N of SKILLS at RANK" (real game format) ────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | 'Two of X or Y at Novice' requires owning two at that rank", () => {
    // Real example: "Two of Charm or Command or Guile or Intuition or Intimidate at Novice"
    // Novice rank = 3
    const twoQualify = makeCtx({ skills: { charm: 3, command: 3, guile: 1, intuition: 1, intimidate: 1 } });
    const oneQualify = makeCtx({ skills: { charm: 3, command: 1, guile: 1, intuition: 1, intimidate: 1 } });

    assert(
        checkSinglePrereq("Two of Charm or Command or Guile or Intuition or Intimidate at Novice", twoQualify),
        "Met when 2 skills (charm, command) are at Novice"
    );
    assert(
        !checkSinglePrereq("Two of Charm or Command or Guile or Intuition or Intimidate at Novice", oneQualify),
        "NOT met when only 1 skill (charm) is at Novice"
    );
});

TestRegistry.register(CATEGORY, "Prereq | 'N of SKILLS at RANK or higher' suffix also works", () => {
    // Verifies that the "or higher" suffix doesn't break N_SKILLS_AT_FROM_LIST_RE
    // by testing that SINGLE_MIN_SKILL_RANK_RE falls through when it finds no valid skills
    const ctx = makeCtx({ skills: { intuition: 6, combat: 4 } });
    assert(
        checkSinglePrereq("1 of Intuition or Combat at Expert Rank or higher", ctx),
        "Met: intuition=6 qualifies at Expert (5)"
    );
    assert(
        !checkSinglePrereq("2 of Intuition or Combat at Expert Rank or higher", ctx),
        "NOT met: only intuition=6 qualifies, combat=4 does not"
    );
});

TestRegistry.register(CATEGORY, "Prereq | Category skill check matches skills by i18n label", () => {
    // "An Education Skill at Master Rank" — any skill whose label contains "education"
    // pokemonEd localizes to "Pokémon Education", generalEd to "General Education", etc.
    const ctxMet    = makeCtx({ skills: { pokemonEd: 6 } });
    const ctxNotMet = makeCtx({ skills: { pokemonEd: 4 } });
    assert(
        checkSinglePrereq("An Education Skill at Master Rank", ctxMet),
        "Category skill 'Education at Master' met when pokemonEd=6"
    );
    assert(
        !checkSinglePrereq("An Education Skill at Master Rank", ctxNotMet),
        "Category skill 'Education at Master' NOT met when pokemonEd=4"
    );
});

// ─── "N of FEAT1 or FEAT2 ..." ───────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | 'N of Feat1 or Feat2' requires owning at least N items", () => {
    const ctxTwo = makeCtx({ itemNames: ["Alpha Strike", "Beta Pulse"] });
    const ctxOne = makeCtx({ itemNames: ["Alpha Strike"] });
    assert(
        checkSinglePrereq("2 of Alpha Strike or Beta Pulse or Gamma Ray", ctxTwo),
        "2-of-3 met when actor has 2 of the listed items"
    );
    assert(
        !checkSinglePrereq("2 of Alpha Strike or Beta Pulse or Gamma Ray", ctxOne),
        "2-of-3 NOT met when actor has only 1 of the listed items"
    );
    assert(
        checkSinglePrereq("One of Alpha Strike or Beta Pulse or Gamma Ray", ctxOne),
        "One-of-3 met when actor has 1 listed item"
    );
});

// ─── General OR clause (feat items) ──────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | General OR between item names (non-skill)", () => {
    const ctx = makeCtx({ itemNames: ["Feat Beta"] });
    assert(checkSinglePrereq("Feat Alpha or Feat Beta", ctx), "OR: met when actor has the second option");
    assert(!checkSinglePrereq("Feat Alpha or Feat Gamma", ctx), "OR: NOT met when actor has neither option");
});

// ─── Item name / slug check ───────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | Item name match is case/diacritic-insensitive", () => {
    const ctx = makeCtx({ itemNames: ["Battle Intuition"] });
    assert(checkSinglePrereq("Battle Intuition", ctx), "Exact item name should match");
});

TestRegistry.register(CATEGORY, "Prereq | Item base name matches parenthetical variant", () => {
    const ctx = makeCtx({ itemNames: ["Elemental Connection (Fairy)"] });
    assert(checkSinglePrereq("Elemental Connection", ctx), "Base name should match parenthetical variant");
});

TestRegistry.register(CATEGORY, "Prereq | Specific parenthetical does NOT match different variant", () => {
    const ctx = makeCtx({ itemNames: ["Elemental Connection (Fairy)"] });
    assert(
        !checkSinglePrereq("Elemental Connection (Fire)", ctx),
        "Specific variant should not match a different parenthetical"
    );
});

// ─── meetsPrereqsWithContext ──────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "meetsPrereqsWithContext | no prerequisites always passes", () => {
    const ctx = makeCtx();
    assert(meetsPrereqsWithContext({ prerequisites: [] }, ctx), "No prerequisites → always true");
    assert(meetsPrereqsWithContext({}, ctx), "Undefined prerequisites → always true");
});

TestRegistry.register(CATEGORY, "meetsPrereqsWithContext | all prereqs must be met", () => {
    const ctx = makeCtx({ level: 5, skills: { combat: 5 } });
    assert(
        meetsPrereqsWithContext({ prerequisites: [{ label: "Level 5" }, { label: "Expert Combat" }] }, ctx),
        "Both Level 5 and Expert Combat met"
    );
    assert(
        !meetsPrereqsWithContext({ prerequisites: [{ label: "Level 5" }, { label: "Master Combat" }] }, ctx),
        "Level 5 met but Master Combat is NOT met"
    );
});

TestRegistry.register(CATEGORY, "meetsPrereqsWithContext | class prereq is checked from itemNames", () => {
    const ctxWith = makeCtx({ itemNames: ["ace trainer"] });
    const ctxWithout = makeCtx();
    const item = { class: "ace trainer", keywords: [], prerequisites: [] };
    assert(meetsPrereqsWithContext(item, ctxWith), "Class prereq met when class item is owned");
    assert(!meetsPrereqsWithContext(item, ctxWithout), "Class prereq NOT met when class item is absent");
});

TestRegistry.register(CATEGORY, "meetsPrereqsWithContext | subclass item satisfies base class prereq (slug)", () => {
    // Actor owns "Type Ace (Bug)"; feat.class slugs:
    //   "type-ace-bug" = the subclass itself
    //   "type-ace"     = the base class shared features
    const ctxSubclass = makeCtx({ itemNames: ["Type Ace (Bug)"] });
    const ctxBase = makeCtx({ itemNames: ["Type Ace"] });
    const ctxNeither = makeCtx();
    const subclassFeat = { class: "type-ace-bug", keywords: [], prerequisites: [] };
    const baseFeat = { class: "type-ace", keywords: [], prerequisites: [] };
    assert(meetsPrereqsWithContext(subclassFeat, ctxSubclass), "Owning 'Type Ace (Bug)' satisfies subclass feat class 'type-ace-bug'");
    assert(meetsPrereqsWithContext(baseFeat, ctxSubclass), "Owning 'Type Ace (Bug)' satisfies base class feat 'type-ace'");
    assert(meetsPrereqsWithContext(baseFeat, ctxBase), "Owning base 'Type Ace' satisfies base class feat 'type-ace'");
    assert(!meetsPrereqsWithContext(subclassFeat, ctxBase), "Owning only base 'Type Ace' does NOT satisfy subclass feat 'type-ace-bug'");
    assert(!meetsPrereqsWithContext(subclassFeat, ctxNeither), "Owning neither does NOT satisfy the prereq");
});

TestRegistry.register(CATEGORY, "checkSinglePrereq | base class prereq text satisfied by subclass item", () => {
    // When a prerequisite is listed as plain text "Type Ace", owning "Type Ace (Bug)" should satisfy it.
    const ctx = makeCtx({ itemNames: ["Type Ace (Bug)"] });
    assert(checkSinglePrereq("Type Ace", ctx), "Prereq 'Type Ace' met when actor owns 'Type Ace (Bug)'");
    assert(!checkSinglePrereq("Type Ace (Ice)", ctx), "Prereq 'Type Ace (Ice)' NOT met when actor only owns 'Type Ace (Bug)'");
});

// ─── Type-Linked Class prerequisites ────────────────────────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | 'A Type-Linked Class' matches any Type Linked keyword", () => {
    const ctxGeneric  = makeCtx({ typeLinkedKeywords: ["Type Linked"] });
    const ctxSpecific = makeCtx({ typeLinkedKeywords: ["Type Linked (Water)"] });
    const ctxNone     = makeCtx();
    assert(checkSinglePrereq("A Type-Linked Class", ctxGeneric),  "Met when actor has generic 'Type Linked' keyword");
    assert(checkSinglePrereq("A Type-Linked Class", ctxSpecific), "Met when actor has 'Type Linked (Water)' keyword");
    assert(!checkSinglePrereq("A Type-Linked Class", ctxNone),    "NOT met when actor has no Type Linked keywords");
});

TestRegistry.register(CATEGORY, "Prereq | 'A Water-Type-Linked Class' matches only the Water variant", () => {
    const ctxWater   = makeCtx({ typeLinkedKeywords: ["Type Linked (Water)"] });
    const ctxFire    = makeCtx({ typeLinkedKeywords: ["Type Linked (Fire)"] });
    const ctxGeneric = makeCtx({ typeLinkedKeywords: ["Type Linked"] });
    assert( checkSinglePrereq("A Water-Type-Linked Class", ctxWater),  "Met when actor has 'Type Linked (Water)'");
    assert(!checkSinglePrereq("A Water-Type-Linked Class", ctxFire),   "NOT met when actor only has 'Type Linked (Fire)'");
    assert(!checkSinglePrereq("A Water-Type-Linked Class", ctxGeneric),"NOT met when actor only has generic 'Type Linked'");
});

// ─── Typed Pokémon prerequisites ─────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | 'N [Different] TYPE Type Pokemon' counts typed pokémon", () => {
    const ctx = makeCtx({ typedPokemonCounts: { Dark: 2, Water: 1 } });
    assert( checkSinglePrereq("1 Dark Type Pokemon", ctx),             "1 Dark met with 2 dark pokémon");
    assert( checkSinglePrereq("2 Different Dark Type Pokemon", ctx),   "2 Different Dark met with 2 dark pokémon");
    assert(!checkSinglePrereq("3 Different Dark Type Pokemon", ctx),   "3 Different Dark NOT met with only 2");
    assert( checkSinglePrereq("1 Water Type Pokémon", ctx),            "1 Water met with 1 water pokémon (accent)");
    assert(!checkSinglePrereq("2 Water Type Pokemon", ctx),            "2 Water NOT met with only 1");
    assert(!checkSinglePrereq("1 Fire Type Pokemon", ctx),             "1 Fire NOT met with 0 fire pokémon");
});

// ─── Typed Pokémon prerequisites ──────────────────────────────────────────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | 'N Pokémon with STAT of AMOUNT' checks stat totals", () => {
    // Trainer has 3 pokémon with atk totals: 120, 90, 75
    const ctx = makeCtx({ pokemonStatTotals: { atk: [120, 90, 75], spd: [110, 60] } });
    assert( checkSinglePrereq("1 Pokémon with Attack of 90",  ctx), "1 Pokémon with Attack of 90: met (2 qualify)");
    assert( checkSinglePrereq("2 Pokémon with Attack of 90",  ctx), "2 Pokémon with Attack of 90: met (2 qualify)");
    assert(!checkSinglePrereq("3 Pokémon with Attack of 90",  ctx), "3 Pokémon with Attack of 90: NOT met (only 2 qualify)");
    assert( checkSinglePrereq("1 Pokemon with Attack of 120",  ctx), "1 Pokemon with Attack of 120: met (1 qualifies)");
    assert(!checkSinglePrereq("2 Pokemon with Attack of 120",  ctx), "2 Pokemon with Attack of 120: NOT met (only 1 qualifies)");
    assert( checkSinglePrereq("1 Pokémon with Speed at 100",  ctx), "'at' variant: met");
    assert( checkSinglePrereq("1 Pokémon with Speed at 110 or more", ctx), "'at X or more' variant: met");
    assert(!checkSinglePrereq("1 Pokémon with Speed of 115",  ctx), "1 Pokémon with Speed of 115: NOT met (max is 110)");
    // Unknown stat name should assume met
    assert( !checkSinglePrereq("1 Pokémon with Wizardry of 9000", ctx), "Unknown stat assumes unmet");
});
// ─── Class feature count prerequisites ────────────────────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | 'N CLASS Features' counts items by system.class", () => {
    // Actor has 5 Skirmisher features and 3 Type Ace features
    const ctx = makeCtx({ featuresByClass: { Skirmisher: 5, 'Type Ace': 3 } });
    assert( checkSinglePrereq("4 Skirmisher Features", ctx), "4 Skirmisher Features: met with 5");
    assert(!checkSinglePrereq("6 Skirmisher Features", ctx), "6 Skirmisher Features: NOT met with 5");
    assert( checkSinglePrereq("3 Type Ace Features", ctx),   "3 Type Ace Features: met");
    assert( checkSinglePrereq("1 Skirmisher Feature", ctx),  "singular 'Feature' variant: met");
    assert(!checkSinglePrereq("1 Hunter Features", ctx),     "1 Hunter Features: NOT met (no hunter features)");
});

TestRegistry.register(CATEGORY, "Prereq | 'N TYPE ACE (FIRE) Features' also counts base class feats", () => {
    // Subclass prerequisite should count both subclass-specific AND base class features
    const ctx = makeCtx({ featuresByClass: { 'Type Ace': 3, 'Type Ace (Fire)': 2 } });
    assert( checkSinglePrereq("4 Type Ace (Fire) Features", ctx),  "4 Type Ace (Fire): met (2+3=5)");
    assert(!checkSinglePrereq("6 Type Ace (Fire) Features", ctx),  "6 Type Ace (Fire): NOT met (only 5 total)");
    // Non-parenthetical only counts its own class
    const ctxBase = makeCtx({ featuresByClass: { 'Type Ace': 3 } });
    assert(!checkSinglePrereq("4 Type Ace (Fire) Features", ctxBase), "base class only: NOT met for subclass-prefixed prereq");
    assert( checkSinglePrereq("3 Type Ace Features", ctxBase),         "3 Type Ace Features: met with 3");
});

// ─── Friendship Pokémon prerequisites ─────────────────────────────────────────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | 'N Friendship X Pokemon' counts pokémon with friendship >= X", () => {
    // 3 pokémon with friendship 5, 4, 2
    const ctx = makeCtx({ pokemonFriendships: [5, 4, 2] });
    // 5≥4 and 4≥4 → 2 qualify for "Friendship 4"
    assert( checkSinglePrereq("Two Friendship 4 Pokemon",   ctx), "Two Friendship 4: met (2 have friendship ≥ 4)");
    assert(!checkSinglePrereq("Three Friendship 4 Pokemon", ctx), "Three Friendship 4: NOT met (only 2 qualify)");
    // Only 5≥5 → 1 qualifies for "Friendship 5"
    assert( checkSinglePrereq("One Friendship 5 Pokemon",   ctx), "One Friendship 5: met (friendship 5 exists)");
    assert(!checkSinglePrereq("Two Friendship 5 Pokemon",   ctx), "Two Friendship 5: NOT met (only one has ≥5)");
    // OR clause: "Three Friendship 4 Pokemon or One Friendship 5 Pokemon" → second term passes
    assert(
        checkSinglePrereq("Three Friendship 4 Pokemon or One Friendship 5 Pokemon", ctx),
        "OR: second term (One Friendship 5) passes"
    );
});
// ─── "All A or B options" grouped prerequisites ───────────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "Prereq | 'All A or B options' – A group satisfied passes", () => {
    // Simulates: all A-options pass, B-options are not checked
    const ctx = makeCtx({ level: 10, skills: { guile: 4 }, itemNames: ["Dark Type Pokemon", "Dark Type Pokemon 2"] });
    const item = {
        prerequisites: [
            { label: "All A or B options" },
            { label: "A: Level 5" },
            { label: "A: Adept Guile" },
            { label: "B: Level 20" },      // would fail on its own
            { label: "B: Master Combat" }, // would fail on its own
        ],
    };
    assert(meetsPrereqsWithContext(item, ctx), "All A options satisfied \u2192 overall pass");
});

TestRegistry.register(CATEGORY, "Prereq | 'All A or B options' – B group satisfied passes", () => {
    const ctx = makeCtx({ level: 10, skills: { guile: 6 } });
    const item = {
        prerequisites: [
            { label: "All A or B options" },
            { label: "A: Level 20" },       // fails
            { label: "A: Master Combat" },  // fails
            { label: "B: Level 5" },
            { label: "B: Master Guile" },
        ],
    };
    assert(meetsPrereqsWithContext(item, ctx), "All B options satisfied \u2192 overall pass");
});

TestRegistry.register(CATEGORY, "Prereq | 'All A or B options' – neither group satisfied fails", () => {
    const ctx = makeCtx({ level: 5, skills: { guile: 3 } });
    const item = {
        prerequisites: [
            { label: "All A or B options" },
            { label: "A: Level 10" },      // fails (level 5)
            { label: "A: Expert Guile" },  // fails (guile 3)
            { label: "B: Level 10" },      // fails (level 5)
            { label: "B: Master Guile" },  // fails (guile 3)
        ],
    };
    assert(!meetsPrereqsWithContext(item, ctx), "Neither group satisfied \u2192 overall fail");
});

TestRegistry.register(CATEGORY, "Prereq | 'All A or B options' – ungrouped prereq failing blocks even when group passes", () => {
    const ctx = makeCtx({ level: 1, skills: { guile: 6 } });
    const item = {
        prerequisites: [
            { label: "All A or B options" },
            { label: "Level 99" },          // ungrouped, fails
            { label: "A: Master Guile" },   // would pass
        ],
    };
    assert(!meetsPrereqsWithContext(item, ctx), "Ungrouped fail blocks overall even when A group passes");
});

TestRegistry.register(CATEGORY, "Prereq | checkSinglePrereq passes meta-line 'All A or B options'", () => {
    assert(checkSinglePrereq("All A or B options", makeCtx()), "Meta-line should always return true from checkSinglePrereq");
});

TestRegistry.register(CATEGORY, "Prereq | checkSinglePrereq strips 'A: ' prefix and checks remainder", () => {
    const ctx = makeCtx({ level: 10 });
    assert(checkSinglePrereq("A: Level 5", ctx),  "'A: Level 5' should be met at level 10");
    assert(!checkSinglePrereq("B: Level 20", ctx), "'B: Level 20' should NOT be met at level 10");
});

TestRegistry.register(CATEGORY, "Prereq | 'does not have X' meta-line", () => {
    const ctx = makeCtx({ itemNames: ["Feature"] });
    assert(!checkSinglePrereq("does not have Feature", ctx),  "'does not have Feature' should NOT be met");
    assert(checkSinglePrereq("does not have Another Feature", ctx), "'does not have Another Feature' should be met");
});
