/**
 * Tests for the InstantChange rule element.
 *
 * InstantChange performs a real actor.update() when a trigger event fires
 * (e.g. onTurnStart, onTurnEnd, onCombatStart, etc.).
 *
 * For the purposes of this test suite we verify:
 *  1. The rule element is registered on the actor and not ignored.
 *  2. When we manually call the corresponding lifecycle hook (e.g. onTurnStart)
 *     on the rule element, the actor data is updated correctly.
 *
 * Note: Full combat-cycle tests (creating a combat and advancing turns) are
 * out of scope for these unit-level checks.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertDefined, assertEqual } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Rule is registered and not ignored
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "InstantChange | rule element is registered and not ignored", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "InstantChange",
            trigger: "onTurnStart",
            mode: "add",
            path: "system.modifiers.acBonus.mod",
            value: 2,
        }]);

        actor = game.actors.get(actor.id);

        const rule = actor.rules.find(r => r.key === "InstantChange");
        assertDefined(rule, "InstantChange rule element should be present on actor.rules");
        if (rule.ignored) throw new Error("InstantChange rule element should not be ignored");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// onTurnStart fires correctly when called manually
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "InstantChange | onTurnStart updates actor when trigger fires", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "InstantChange",
            trigger: "onTurnStart",
            mode: "add",
            path: "system.health.injuries",
            value: 1,
        }]);

        actor = game.actors.get(actor.id);
        const beforeInjuries = actor.system.health.injuries ?? 0;

        // Simulate the turn-start hook by gathering updates from the rule element.
        const updates = {};
        for (const rule of actor.rules) {
            if (rule.key === "InstantChange" && rule.trigger === "onTurnStart") {
                await rule.onTurnStart?.(updates);
            }
        }

        if (Object.keys(updates).length > 0) {
            await actor.update(updates);
            actor = game.actors.get(actor.id);
        }

        const afterInjuries = actor.system.health.injuries ?? 0;
        assertEqual(afterInjuries, beforeInjuries + 1,
            "InstantChange onTurnStart should have incremented injuries by 1");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
