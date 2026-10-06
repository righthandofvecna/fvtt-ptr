/**
 * Tests for the FlatModifier rule element.
 *
 * FlatModifier does NOT directly modify `system.stats.*` totals.  Instead it
 * registers deferred modifier constructors in `actor.synthetics.statisticsModifiers[selector]`.
 * Those are then consumed (via `extractModifiers`) when building attack / skill checks.
 *
 * The tests below verify:
 *   1. A modifier with the expected value appears in the synthetics after the item is added.
 *   2. A modifier with a failing predicate is not emitted.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertEqual, assertGreaterThan, assertDefined } from "../helpers/assert.js";
import { extractModifiers } from "../../module/rules/helpers.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Basic modifier registration
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "FlatModifier | registers modifier in statisticsModifiers[selector]", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "FlatModifier",
            selectors: ["test-flat-mod-selector"],
            value: 7,
        }]);

        actor = game.actors.get(actor.id);

        const modifiers = extractModifiers(actor.synthetics, ["test-flat-mod-selector"]);
        assertGreaterThan(modifiers.length, 0, "At least one modifier should be registered for the selector");

        const mod = modifiers.find(m => m.modifier === 7);
        assertDefined(mod, "Expected a modifier with value 7 to be registered");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Negative modifier (penalty)
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "FlatModifier | registers negative modifier (penalty)", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "FlatModifier",
            selectors: ["test-flat-mod-penalty"],
            value: -3,
        }]);

        actor = game.actors.get(actor.id);

        const modifiers = extractModifiers(actor.synthetics, ["test-flat-mod-penalty"]);
        const mod = modifiers.find(m => m.modifier === -3);
        assertDefined(mod, "Expected a modifier with value -3 to be registered");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Predicate: modifier is not emitted when predicate fails
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "FlatModifier | predicate prevents modifier when condition not met", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "FlatModifier",
            selectors: ["test-flat-mod-predicate"],
            value: 10,
            predicate: ["self:level:50"], // will not be satisfied on our bare actor
        }]);

        actor = game.actors.get(actor.id);
        const rollOptions = actor.getRollOptions(["all"]);
        const modifiers = extractModifiers(actor.synthetics, ["test-flat-mod-predicate"], { test: rollOptions });

        // PTUModifier.test() sets modifier.ignored = true when predicate fails.
        // Check that no non-ignored modifiers remain for this selector.
        const activeModifiers = modifiers.filter(m => !m.ignored);
        assertEqual(activeModifiers.length, 0, "Modifier with failing predicate should be ignored");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Multiple selectors
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "FlatModifier | appears in all listed selectors", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "FlatModifier",
            selectors: ["multi-sel-a", "multi-sel-b"],
            value: 4,
        }]);

        actor = game.actors.get(actor.id);

        const modsA = extractModifiers(actor.synthetics, ["multi-sel-a"]);
        const modsB = extractModifiers(actor.synthetics, ["multi-sel-b"]);

        assertGreaterThan(modsA.length, 0, "Modifier should appear under selector multi-sel-a");
        assertGreaterThan(modsB.length, 0, "Modifier should appear under selector multi-sel-b");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
