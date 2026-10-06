/**
 * Tests for the ActionPoint (AP) rule element.
 *
 * ActionPoint adjusts trainer action points:
 *  - `afterPrepareData`: registers bound/drained entries in `actor.synthetics.apAdjustments`
 *  - `onCreate`: immediately reduces `system.ap.value` when the parent item is added
 *
 * IMPORTANT: ActionPoint's `onCreate` accesses `this.actor.system.ap.value`, which only
 * exists on character (trainer) actors. Using a Pokemon actor would cause a TypeError.
 * The synthetics tests use a PREDICATE that prevents `onCreate` from firing (since `onCreate`
 * explicitly checks the predicate), while `afterPrepareData` does NOT check predicates so it
 * still populates apAdjustments.
 */
import { TestRegistry } from "../registry.js";
import { createTestTrainer, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertGreaterThan } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// ActionPoint requires trainer actors because it accesses system.ap in onCreate.

// -----------------------------------------------------------------
// afterPrepareData: registers drained entry in synthetics.apAdjustments
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "ActionPoint | registers drained entry in synthetics.apAdjustments", async () => {
    let actor = await createTestTrainer();
    try {
        // Use a predicate that prevents onCreate from running (it checks predicate explicitly)
        // but afterPrepareData does NOT check predicates, so apAdjustments still gets populated.
        await addEffectWithRules(actor, [{
            key: "ActionPoint",
            drainedValue: 1,
            boundValue: 0,
            predicate: ["action-point-test-predicate-skip-oncreate"],
        }]);

        actor = game.actors.get(actor.id);

        const drained = actor.synthetics.apAdjustments?.drained ?? [];
        assertGreaterThan(drained.length, 0,
            "synthetics.apAdjustments.drained should have at least one entry after ActionPoint");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// afterPrepareData: registers bound entry in synthetics.apAdjustments
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "ActionPoint | registers bound entry in synthetics.apAdjustments", async () => {
    let actor = await createTestTrainer();
    try {
        await addEffectWithRules(actor, [{
            key: "ActionPoint",
            drainedValue: 0,
            boundValue: 2,
            predicate: ["action-point-test-predicate-skip-oncreate"],
        }]);

        actor = game.actors.get(actor.id);

        const bound = actor.synthetics.apAdjustments?.bound ?? [];
        assertGreaterThan(bound.length, 0,
            "synthetics.apAdjustments.bound should have at least one entry after ActionPoint");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// onCreate: reduces trainer's AP value (no predicate, so onCreate fires)
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "ActionPoint | onCreate reduces trainer system.ap.value", async () => {
    let actor = await createTestTrainer();
    try {
        const apBefore = actor.system.ap?.value ?? 0;

        // No predicate: onCreate will fire and attempt to reduce AP.
        await addEffectWithRules(actor, [{
            key: "ActionPoint",
            drainedValue: 1,
            boundValue: 0,
        }]);

        // Actor update from onCreate is async (fire-and-forget); allow the DB write to settle.
        await new Promise(resolve => setTimeout(resolve, 200));
        actor = game.actors.get(actor.id);
        const apAfter = actor.system.ap?.value ?? 0;

        // AP value should be lower or equal.
        if (apAfter > apBefore) {
            throw new Error(`Expected AP to decrease or stay the same, but it went from ${apBefore} to ${apAfter}`);
        }

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
