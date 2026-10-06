/**
 * Tests for the HealOnDamageDealt rule element.
 *
 * HealOnDamageDealt registers a synthetic construct in
 * `actor.synthetics.healOnDamageDealt[selector][healId]` during `beforePrepareData`.
 * The actual healing happens after damage is applied to a target.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertDefined, assertGreaterThan } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Registers construct in synthetics
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "HealOnDamageDealt | registers construct in synthetics.healOnDamageDealt", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "HealOnDamageDealt",
            selectors: ["damage-dealt"],
            percent: 0.5,
        }]);

        actor = game.actors.get(actor.id);

        const synth = actor.synthetics.healOnDamageDealt;
        assertDefined(synth, "actor.synthetics.healOnDamageDealt should be defined after HealOnDamageDealt");
        const bucket = synth?.["damage-dealt"];
        assertDefined(bucket, "Bucket for 'damage-dealt' selector should exist");
        assertGreaterThan(Object.keys(bucket).length, 0, "Bucket should have at least one construct");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Negative percent (recoil)
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "HealOnDamageDealt | accepts negative percent (recoil)", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "HealOnDamageDealt",
            selectors: ["damage-dealt"],
            percent: -0.25,
        }]);

        actor = game.actors.get(actor.id);

        const synth = actor.synthetics.healOnDamageDealt;
        assertDefined(synth?.["damage-dealt"], "Bucket for 'damage-dealt' selector should exist for recoil");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
