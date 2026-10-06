/**
 * Tests for the RollOption rule element.
 *
 * RollOption sets a boolean flag in the actor's `rollOptions` under a given domain.
 * The flag is visible on `actor.rollOptions[domain][option]`.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertEqual, assert } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Sets option in "all" domain
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "RollOption | sets flag in 'all' domain", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const option = "test:roll-option:basic";
        await addEffectWithRules(actor, [{
            key: "RollOption",
            domain: "all",
            option,
        }]);

        actor = game.actors.get(actor.id);
        assert(actor.rollOptions.all[option] === true, `Expected rollOptions.all["${option}"] to be true`);

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Sets option in a custom domain
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "RollOption | sets flag in a custom domain", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const option = "test:roll-option:custom";
        await addEffectWithRules(actor, [{
            key: "RollOption",
            domain: "test-domain",
            option,
        }]);

        actor = game.actors.get(actor.id);
        assert(actor.rollOptions["test-domain"]?.[option] === true,
            `Expected rollOptions["test-domain"]["${option}"] to be true`);

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Option is visible in getRollOptions()
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "RollOption | option appears in getRollOptions(['all'])", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const option = "test:roll-option:retrieve";
        await addEffectWithRules(actor, [{
            key: "RollOption",
            domain: "all",
            option,
        }]);

        actor = game.actors.get(actor.id);
        const options = actor.getRollOptions(["all"]);
        assert(options.includes(option), `Expected getRollOptions to include "${option}"`);

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Predicate: option is not set when predicate fails
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "RollOption | predicate prevents option when condition not met", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const option = "test:roll-option:predicated";
        await addEffectWithRules(actor, [{
            key: "RollOption",
            domain: "all",
            option,
            predicate: ["self:level:50"],  // actor has no level:50 flag
        }]);

        actor = game.actors.get(actor.id);
        const options = actor.getRollOptions(["all"]);
        assert(!options.includes(option), `getRollOptions should NOT include "${option}" with failing predicate`);

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
