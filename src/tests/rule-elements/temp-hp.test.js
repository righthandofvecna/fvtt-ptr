/**
 * Tests for the TempHP rule element.
 *
 * TempHP grants temporary HP to the actor in its `onCreate` callback (which fires
 * when the parent item is added to the actor via createEmbeddedDocuments).
 * It also broadcasts a chat message to owner users — that's expected side-effect behaviour.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertEqual, assertGreaterThan } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Basic grant
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "TempHP | grants temporary HP when item is added", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "TempHP",
            value: 20,
        }]);

        // TempHP.onCreate calls actor.update() without awaiting; allow the DB write to settle.
        await new Promise(resolve => setTimeout(resolve, 200));
        actor = game.actors.get(actor.id);
        assertEqual(actor.system.tempHp?.value, 20, "TempHP should set system.tempHp.value to 20");
        assertEqual(actor.system.tempHp?.max, 20, "TempHP should also set system.tempHp.max to 20");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Does not downgrade existing temp HP
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "TempHP | does not replace a higher existing temp HP value", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        // Add a high TempHP first.
        await addEffectWithRules(actor, [{ key: "TempHP", value: 30 }], { name: "[TEST] TempHP High" });
        await new Promise(resolve => setTimeout(resolve, 200));
        actor = game.actors.get(actor.id);
        assertEqual(actor.system.tempHp?.value, 30, "First TempHP should set value to 30");

        // Adding a lower value should NOT overwrite the higher one.
        await addEffectWithRules(actor, [{ key: "TempHP", value: 10 }], { name: "[TEST] TempHP Low" });
        await new Promise(resolve => setTimeout(resolve, 200));
        actor = game.actors.get(actor.id);
        assertEqual(actor.system.tempHp?.value, 30, "Lower TempHP should not overwrite higher existing value");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
