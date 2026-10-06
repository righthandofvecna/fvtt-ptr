/**
 * Tests for the Effectiveness rule element.
 *
 * Effectiveness registers deferred constructs in `actor.synthetics.effectiveness[]`
 * which are consumed when computing IWR (Immunities, Weaknesses, Resistances).
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemon, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertGreaterThan, assertDefined, assertEqual } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Synthetics registration
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "Effectiveness | registers construct in actor.synthetics.effectiveness", async () => {
    // Use a species actor so onPrepareDerivedData runs and IWR is computed.
    let actor = await createTestPokemon("rattata");
    try {
        const beforeCount = actor.synthetics.effectiveness.length;

        await addEffectWithRules(actor, [{
            key: "Effectiveness",
            type: "Normal",
            value: 0,
        }]);

        actor = game.actors.get(actor.id);
        assertGreaterThan(actor.synthetics.effectiveness.length, beforeCount,
            "Effectiveness should add a construct to actor.synthetics.effectiveness");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// IWR impact: immunity (value=0) removes the normal type from weaknesses/resistances
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "Effectiveness | value=0 makes actor immune to that type", async () => {
    // Rattata is Normal type, so it's weak to Fighting by default.
    let actor = await createTestPokemon("rattata");
    try {
        // Make the actor immune to Fighting.
        await addEffectWithRules(actor, [{
            key: "Effectiveness",
            type: "Fighting",
            value: 0,
        }]);

        actor = game.actors.get(actor.id);
        const iwr = actor.iwr;
        const fightingImmunity = iwr.immunities.find(i => i.type === "fighting");
        assertDefined(fightingImmunity, "Actor should have a Fighting immunity after Effectiveness value=0");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
