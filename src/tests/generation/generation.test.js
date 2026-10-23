/**
 * Integration tests for Pokémon generation — covering getMinLevelFromPredicate
 * and the PokemonGenerator evolution-selection logic.
 */
import { TestRegistry } from "../registry.js";
import { assertEqual, assert } from "../helpers/index.js";
import { getMinLevelFromPredicate, findItemInCompendium } from "../../util/misc.js";
import { PokemonGenerator } from "../../module/actor/pokemon/generator.js";

const CATEGORY = "generation";

// ─────────────────────────────────────────────────────────────────────────────
// getMinLevelFromPredicate — unit-style checks
// ─────────────────────────────────────────────────────────────────────────────

TestRegistry.register(CATEGORY, "getMinLevelFromPredicate | empty array returns 1", () => {
    assertEqual(getMinLevelFromPredicate([]), 1, "Empty predicate should return 1");
});

TestRegistry.register(CATEGORY, "getMinLevelFromPredicate | string array returns correct level", () => {
    assertEqual(getMinLevelFromPredicate(["self:level:5+"]), 5, 'Should extract 5 from ["self:level:5+"]');
    assertEqual(getMinLevelFromPredicate(["self:level:10+"]), 10, 'Should extract 10 from ["self:level:10+"]');
    assertEqual(getMinLevelFromPredicate(["self:level:100+"]), 100, 'Should extract 100 from ["self:level:100+"]');
});

TestRegistry.register(CATEGORY, "getMinLevelFromPredicate | bare string returns correct level", () => {
    assertEqual(getMinLevelFromPredicate("self:level:7+"), 7, "Bare string input should extract 7");
});

TestRegistry.register(CATEGORY, "getMinLevelFromPredicate | non-level predicate returns 1", () => {
    assertEqual(getMinLevelFromPredicate(["self:gender:female"]), 1, "Gender-only predicate should return 1");
});

TestRegistry.register(CATEGORY, "getMinLevelFromPredicate | mixed predicates returns first level found", () => {
    assertEqual(
        getMinLevelFromPredicate(["self:gender:male", "self:level:15+"]),
        15,
        "Should find level in mixed predicate array"
    );
});

TestRegistry.register(CATEGORY, "getMinLevelFromPredicate | nested or-predicate extracts level", () => {
    const predicate = [{ or: ["self:level:8+", "self:gender:female"] }];
    assertEqual(getMinLevelFromPredicate(predicate), 8, "Should extract level from nested or-predicate");
});

// ─────────────────────────────────────────────────────────────────────────────
// PokemonGenerator — evolution selection (Weedle → Kakuna → Beedrill chain)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper — load a species from the compendium and run the generator at the
 * given level. Returns the generator after prepare() completes.
 * @param {string} speciesName
 * @param {number} level
 * @param {boolean} preventEvolution
 */
async function runGenerator(speciesName, level, preventEvolution = false) {
    const species = await findItemInCompendium({ type: "species", name: speciesName });
    if (!species) throw new Error(`Species "${speciesName}" not found in compendium`);
    const generator = new PokemonGenerator(species);
    await generator.prepare({
        minLevel: level,
        maxLevel: level,
        shinyChance: 0,
        statRandomness: 0,
        preventEvolution,
    });
    return generator;
}

TestRegistry.register(CATEGORY, "Generator | Beedrill at level 20 resolves to Beedrill", async () => {
    const generator = await runGenerator("Beedrill", 20);
    assertEqual(generator.species.name, "Beedrill", "Level 20 should yield Beedrill (highest eligible stage)");
}, { description: "Regression test for the getMinLevelFromPredicate array-wrapping bug." });

TestRegistry.register(CATEGORY, "Generator | Weedle at level 1 stays as Weedle", async () => {
    const generator = await runGenerator("Weedle", 1);
    assertEqual(generator.species.name, "Weedle", "Level 1 should yield Weedle (no evolution threshold met)");
});

TestRegistry.register(CATEGORY, "Generator | Weedle at level 5 resolves to Kakuna", async () => {
    const generator = await runGenerator("Weedle", 5);
    assertEqual(generator.species.name, "Kakuna", "Level 5 meets Kakuna threshold (5+) but not Beedrill (10+)");
});

TestRegistry.register(CATEGORY, "Generator | Weedle at level 10 resolves to Beedrill", async () => {
    const generator = await runGenerator("Weedle", 10);
    assertEqual(generator.species.name, "Beedrill", "Level 10 meets Beedrill threshold (10+)");
});

TestRegistry.register(CATEGORY, "Generator | Weedle at level 9 resolves to Kakuna", async () => {
    const generator = await runGenerator("Weedle", 9);
    assertEqual(generator.species.name, "Kakuna", "Level 9 exceeds Kakuna (5+) but not Beedrill (10+)");
});

TestRegistry.register(CATEGORY, "Generator | preventEvolution keeps original species", async () => {
    const generator = await runGenerator("Weedle", 20, true);
    assertEqual(generator.species.name, "Weedle", "preventEvolution=true should keep Weedle regardless of level");
});

TestRegistry.register(CATEGORY, "Generator | Beedrill at level 9 resolves to Kakuna", async () => {
    const generator = await runGenerator("Beedrill", 9);
    assertEqual(generator.species.name, "Kakuna", "Beedrill at level 9: Kakuna (5+) eligible, Beedrill (10+) not");
});
