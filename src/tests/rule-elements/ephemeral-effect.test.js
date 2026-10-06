/**
 * Tests for the EphemeralEffect rule element.
 *
 * EphemeralEffect registers deferred effect constructors in
 * `actor.synthetics.ephemeralEffects[selector][affects]`.
 * These are applied to contextual clones during attack rolls.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertDefined, assertGreaterThan } from "../helpers/assert.js";
import { findItemInCompendium } from "../../util/misc.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Registers deferred construct for target
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "EphemeralEffect | registers deferred construct in ephemeralEffects", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const effectItem = await findItemInCompendium({ type: "effect", name: "Burned" });
        if (!effectItem) throw new Error("Could not find 'Burned' in the effects compendium.");

        await addEffectWithRules(actor, [{
            key: "EphemeralEffect",
            uuid: effectItem.uuid,
            affects: "target",
            selectors: ["test-ephemeral-selector"],
        }]);

        actor = game.actors.get(actor.id);

        const bucket = actor.synthetics.ephemeralEffects?.["test-ephemeral-selector"];
        assertDefined(bucket, "ephemeralEffects should have an entry for the selector");
        assertGreaterThan(bucket.target.length, 0, "Target bucket should have at least one deferred construct");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Registers deferred construct for origin
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "EphemeralEffect | registers construct in origin bucket", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const effectItem = await findItemInCompendium({ type: "effect", name: "Burned" });
        if (!effectItem) throw new Error("Could not find 'Burned' in the effects compendium.");

        await addEffectWithRules(actor, [{
            key: "EphemeralEffect",
            uuid: effectItem.uuid,
            affects: "origin",
            selectors: ["test-ephemeral-origin-selector"],
        }]);

        actor = game.actors.get(actor.id);
        const bucket = actor.synthetics.ephemeralEffects?.["test-ephemeral-origin-selector"];
        assertDefined(bucket, "ephemeralEffects should have an entry for the selector");
        assertGreaterThan(bucket.origin.length, 0, "Origin bucket should have at least one deferred construct");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
