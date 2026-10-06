/**
 * Tests for the ActiveEffectLike (AELike) rule element.
 *
 * AELike directly modifies actor properties during data preparation.
 * Most tests here use a Pokemon actor WITHOUT a species, which is fine because
 * AELike in the "applyAEs" phase runs before `onPrepareDerivedData` (which is
 * the only phase that requires a species item).
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertEqual, assertNotEqual } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// mode: add
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "AELike | mode=add increases numeric actor path", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const before = actor.system.modifiers.acBonus.mod ?? 0;
        assertEqual(before, 0, "Baseline acBonus.mod should be 0");

        await addEffectWithRules(actor, [{
            key: "ActiveEffectLike",
            mode: "add",
            path: "system.modifiers.acBonus.mod",
            value: 5,
            phase: "applyAEs",
        }]);

        actor = game.actors.get(actor.id);
        assertEqual(actor.system.modifiers.acBonus.mod, 5, "AELike add should set acBonus.mod to 5");
        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// mode: override
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "AELike | mode=override sets actor path to exact value", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "ActiveEffectLike",
            mode: "override",
            path: "system.modifiers.acBonus.mod",
            value: 99,
            phase: "applyAEs",
        }]);

        actor = game.actors.get(actor.id);
        assertEqual(actor.system.modifiers.acBonus.mod, 99, "AELike override should set acBonus.mod to 99");
        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// mode: multiply
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "AELike | mode=multiply scales an existing value", async () => {
    // Seed the actor with a non-default value first via an add, then multiply.
    let actor = await createTestPokemonNoSpecies();
    try {
        // First set acBonus.mod to 4 with add.
        await addEffectWithRules(actor, [
            { key: "ActiveEffectLike", mode: "add", path: "system.modifiers.acBonus.mod", value: 4, phase: "applyAEs" },
            { key: "ActiveEffectLike", mode: "multiply", path: "system.modifiers.acBonus.mod", value: 3, phase: "applyAEs", priority: 30 },
        ], { name: "[TEST] Multiply Effect" });

        actor = game.actors.get(actor.id);
        assertEqual(actor.system.modifiers.acBonus.mod, 12, "AELike multiply should yield 4 × 3 = 12");
        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// predicate: effect is skipped when predicate does not pass
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "AELike | predicate prevents modification when condition not met", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        // Predicate requires "self:level:50" which will not be set on a level-1-ish actor without species.
        await addEffectWithRules(actor, [{
            key: "ActiveEffectLike",
            mode: "add",
            path: "system.modifiers.acBonus.mod",
            value: 7,
            phase: "applyAEs",
            predicate: ["self:level:50"],
        }]);

        actor = game.actors.get(actor.id);
        assertEqual(actor.system.modifiers.acBonus.mod, 0, "AELike with failing predicate should not modify acBonus.mod");
        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
