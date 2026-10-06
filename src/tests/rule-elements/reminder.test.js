/**
 * Tests for the Reminder rule element.
 *
 * Reminder registers deferred message constructors in
 * `actor.synthetics.reminders[selector][reminderId]` during `beforePrepareData`.
 * The actual reminder messages are sent during roll hooks.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertDefined, assertGreaterThan } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Registers construct in synthetics.reminders
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "Reminder | registers construct in actor.synthetics.reminders", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        await addEffectWithRules(actor, [{
            key: "Reminder",
            selectors: ["test-reminder-selector"],
            affects: "origin",
            message: "Test reminder message.",
        }]);

        actor = game.actors.get(actor.id);

        const reminders = actor.synthetics.reminders;
        assertDefined(reminders, "actor.synthetics.reminders should be defined after Reminder");
        const bucket = reminders?.["test-reminder-selector"];
        assertDefined(bucket, "reminders should have a key for the selector");
        assertGreaterThan(Object.keys(bucket).length, 0, "Bucket should have at least one reminder entry");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
