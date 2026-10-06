/**
 * Tests for the TemporarySpecies rule element.
 *
 * TemporarySpecies sets `actor.synthetics.speciesOverride.species` during
 * `beforePrepareData`, which causes `actor.species` to return the override
 * instead of the actor's own species item.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemon, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertDefined, assertNotEqual, assertEqual } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Sets speciesOverride when uuid is provided
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "TemporarySpecies | sets synthetics.speciesOverride.species from uuid", async () => {
    // Start with Rattata; temporarily apply Pikachu's species data via the rule element.
    let actor = await createTestPokemon("rattata");
    try {
        // Find Pikachu's species item to use as the UUID for the override.
        const pikachu = await game.ptu.species.query(s => s.system?.slug === "pikachu" || s.name === "Pikachu");
        if (!pikachu?.length) throw new Error("Could not find Pikachu in the species compendium.");
        const pikachuUuid = pikachu[0].uuid;

        const originalSpeciesSlug = actor.species?.slug;

        await addEffectWithRules(actor, [{
            key: "TemporarySpecies",
            uuid: pikachuUuid,
        }]);

        actor = game.actors.get(actor.id);

        const override = actor.synthetics.speciesOverride.species;
        assertDefined(override, "synthetics.speciesOverride.species should be set after TemporarySpecies");
        assertNotEqual(override.slug ?? override.system?.slug, originalSpeciesSlug,
            "The overriding species should differ from the original species");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
