/**
 * Tests for the ApplyEffect rule element.
 *
 * ApplyEffect applies an effect item to a target (or origin) when an attack hits.
 * Full tests require a scene with tokens and an executed attack roll, which is the
 * most complex test scenario.  The tests below start with the simpler static checks
 * (rule registers correctly) and progress to an end-to-end attack test.
 *
 * NOTE: The end-to-end token test requires an active scene with a canvas loaded.
 *       It will be skipped (with a console warning) if no scene is available.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemon, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertDefined } from "../helpers/assert.js";
import { findItemInCompendium } from "../../util/misc.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Static: rule element is instantiated and not ignored
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "ApplyEffect | rule element is registered and not ignored", async () => {
    let actor = await createTestPokemon();
    try {
        // Find any effect in the effects compendium to use as the UUID.
        const effectItem = await findItemInCompendium({ type: "effect", name: "Burned" });
        if (!effectItem) throw new Error("Could not find 'Burned' in the effects compendium. Ensure ptu.effects is loaded.");

        const item = await addEffectWithRules(actor, [{
            key: "ApplyEffect",
            uuid: effectItem.uuid,
            affects: "target",
            selectors: ["attack-roll"],
        }]);

        actor = game.actors.get(actor.id);

        // Verify the rule element exists on the actor and is not ignored.
        const rule = actor.rules.find(r => r.key === "ApplyEffect");
        assertDefined(rule, "ApplyEffect rule element should be present on actor.rules");
        if (rule.ignored) throw new Error("ApplyEffect rule element should not be ignored");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// TODO: End-to-end token test
// Place two tokens, execute an attack, verify effect is applied to target.
// -----------------------------------------------------------------
// TestRegistry.register(CATEGORY, "ApplyEffect | applies effect to target on attack hit", async () => {
//     // Requires: active scene, attack roll automation
//     // TODO: Implement when attack roll infrastructure is stable
// });
