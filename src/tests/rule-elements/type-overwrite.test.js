/**
 * Tests for the TypeOverwrite rule element.
 *
 * TypeOverwrite changes the actor's typing after data preparation.
 * These tests require a full Pokemon actor WITH a species, since typing is
 * derived from the species' type data in `onPrepareDerivedData`.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemon, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assert, assertContains, assertNotContains, assertEqual } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// Rattata is Normal type — a reliable baseline for type tests.
const SPECIES = "rattata";

// -----------------------------------------------------------------
// overwrite=true: replaces all typing
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "TypeOverwrite | overwrite=true replaces actor typing", async () => {
    let actor = await createTestPokemon(SPECIES);
    try {
        // Verify baseline
        assertContains(actor.types, "Normal", "Rattata should start as Normal type");

        await addEffectWithRules(actor, [{
            key: "TypeOverwrite",
            value: "Fire",
            overwrite: true,
        }]);

        actor = game.actors.get(actor.id);
        assertContains(actor.types, "Fire", "Actor types should include Fire after overwrite");
        assertContains(actor.system.typing, "Fire", "Actor typing should include Fire after overwrite");
        assert(actor.flags.ptu.rollOptions.all["self:types:fire"], "Roll options should include Fire after overwrite");
        assertNotContains(actor.types, "Normal", "Normal type should be replaced");
        assertNotContains(actor.system.typing, "Normal", "Normal type should be replaced in system typing");
        assert(!actor.flags.ptu.rollOptions.all["self:types:normal"], "Roll options should not include Normal after overwrite");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// overwrite=false: adds type without replacing
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "TypeOverwrite | overwrite=false adds a type alongside existing", async () => {
    let actor = await createTestPokemon(SPECIES);
    try {
        assertContains(actor.types, "Normal", "Rattata should start as Normal type");

        await addEffectWithRules(actor, [{
            key: "TypeOverwrite",
            value: "Fire",
            overwrite: false,
        }]);

        actor = game.actors.get(actor.id);
        assertContains(actor.types, "Fire", "Fire type should be added");
        assertContains(actor.system.typing, "Fire", "Actor typing should include Fire after adding");
        assert(actor.flags.ptu.rollOptions.all["self:types:fire"], "Roll options should include Fire after adding");
        assertContains(actor.types, "Normal", "Normal type should be retained with overwrite=false");
        assertContains(actor.system.typing, "Normal", "Actor typing should still include Normal after adding");
        assert(actor.flags.ptu.rollOptions.all["self:types:normal"], "Roll options should include Normal after adding");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Dual-type overwrite
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "TypeOverwrite | can set multiple types at once", async () => {
    let actor = await createTestPokemon(SPECIES);
    try {
        await addEffectWithRules(actor, [{
            key: "TypeOverwrite",
            value: ["Water", "Ice"],
            overwrite: true,
        }]);

        actor = game.actors.get(actor.id);
        assertContains(actor.types, "Water", "Water type should be present");
        assertContains(actor.system.typing, "Water", "Actor typing should include Water");
        assert(actor.flags.ptu.rollOptions.all["self:types:water"], "Roll options should include Water after overwrite");
        assertContains(actor.types, "Ice", "Ice type should be present");
        assertContains(actor.system.typing, "Ice", "Actor typing should include Ice");
        assert(actor.flags.ptu.rollOptions.all["self:types:ice"], "Roll options should include Ice after overwrite");
        assertNotContains(actor.types, "Normal", "Normal type should be replaced");
        assertNotContains(actor.system.typing, "Normal", "Normal type should be replaced in system typing");
        assert(!actor.flags.ptu.rollOptions.all["self:types:normal"], "Roll options should not include Normal after overwrite");
        assertEqual(actor.types.filter(t => t !== "Water" && t !== "Ice").length, 0,
            "Only Water and Ice types should be present");
        assertEqual(actor.system.typing.filter(t => t !== "Water" && t !== "Ice").length, 0,
            "Only Water and Ice types should be present in system typing");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
