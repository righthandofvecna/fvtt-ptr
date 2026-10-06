/**
 * Tests for TokenImage, TokenName, and TokenLight rule elements.
 *
 * All three populate `actor.synthetics.tokenOverrides` during `afterPrepareData`.
 * They work without a species item (tokenOverrides is populated before the
 * species-required `onPrepareDerivedData` phase).
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertEqual, assertDefined } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// TokenName
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "TokenName | sets synthetics.tokenOverrides.name", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "TokenName",
            value: "Test Override Name",
        }]);

        actor = game.actors.get(actor.id);
        assertEqual(actor.synthetics.tokenOverrides.name, "Test Override Name",
            "TokenName should set synthetics.tokenOverrides.name");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

TestRegistry.register(CATEGORY, "TokenName | predicate prevents name override when not met", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "TokenName",
            value: "Should Not Apply",
            predicate: ["self:level:50"],
        }]);

        actor = game.actors.get(actor.id);
        const name = actor.synthetics.tokenOverrides.name;
        if (name === "Should Not Apply") {
            throw new Error("TokenName with failing predicate should NOT set tokenOverrides.name");
        }

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// TokenImage
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "TokenImage | sets synthetics.tokenOverrides.texture.src", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        // Use a valid image-extension path (doesn't need to be a real file for the test).
        await addEffectWithRules(actor, [{
            key: "TokenImage",
            value: "systems/ptu/static/images/test-override.png",
        }]);

        actor = game.actors.get(actor.id);
        const texture = actor.synthetics.tokenOverrides.texture;
        assertDefined(texture, "synthetics.tokenOverrides.texture should be defined after TokenImage");
        assertEqual(texture.src, "systems/ptu/static/images/test-override.png",
            "TokenImage should set texture.src");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// TokenLight
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "TokenLight | sets synthetics.tokenOverrides.light", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "TokenLight",
            value: { dim: 6, bright: 3 },
        }]);

        actor = game.actors.get(actor.id);
        const light = actor.synthetics.tokenOverrides.light;
        assertDefined(light, "synthetics.tokenOverrides.light should be set after TokenLight");
        assertEqual(light.dim, 6, "TokenLight dim radius should be 6");
        assertEqual(light.bright, 3, "TokenLight bright radius should be 3");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
