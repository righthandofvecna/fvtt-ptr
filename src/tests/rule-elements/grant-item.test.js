/**
 * Tests for the GrantItem rule element.
 *
 * GrantItem grants another item (from a compendium UUID) when its parent item is
 * added to an actor.  These tests verify:
 *   1. The granted item appears on the actor after the granting item is created.
 *   2. The granted item is removed when the granting item is deleted (cascade).
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertEqual, assertDefined, assertGreaterThan } from "../helpers/assert.js";
import { findItemInCompendium } from "../../util/misc.js";

const CATEGORY = "rule-elements";

/**
 * Returns the UUID of a known compendium ability (Adaptability) for use in GrantItem tests.
 * If the ability is not found in the compendium the test throws a clear error.
 */
async function getGrantableItemUUID() {
    const item = await findItemInCompendium({ type: "ability", name: "Adaptability" });
    if (!item) throw new Error("Could not find 'Adaptability' in the abilities compendium. Ensure ptu.abilities is loaded.");
    return item.uuid;
}

// -----------------------------------------------------------------
// Granted item appears after parent item is added
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "GrantItem | granted item appears on actor when parent is added", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const uuid = await getGrantableItemUUID();
        const itemsBefore = actor.items.size;

        const grantingItem = await addEffectWithRules(actor, [{
            key: "GrantItem",
            uuid,
            onDeleteActions: { grantee: "cascade" },
        }], { name: "[TEST] GrantItem Source" });

        actor = game.actors.get(actor.id);

        // We expect the actor to have both the granting effect AND the granted ability.
        assertGreaterThan(actor.items.size, itemsBefore + 1 - 1,
            "Actor should have at least one more item after GrantItem fires");

        const grantedAbility = actor.items.find(i => i.type === "ability" && i.slug === "adaptability");
        assertDefined(grantedAbility, "Granted 'Adaptability' ability should be present on actor");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Cascade delete: granted item is removed when granting item is deleted
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "GrantItem | cascade delete removes granted item", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const uuid = await getGrantableItemUUID();

        const grantingItem = await addEffectWithRules(actor, [{
            key: "GrantItem",
            uuid,
            onDeleteActions: { grantee: "cascade" },
        }], { name: "[TEST] GrantItem Cascade" });

        actor = game.actors.get(actor.id);
        assertDefined(
            actor.items.find(i => i.type === "ability" && i.slug === "adaptability"),
            "Ability should be present before deletion"
        );

        // Delete the granting item — this should cascade-delete the granted ability.
        const grantingOnActor = actor.items.get(grantingItem.id);
        assertDefined(grantingOnActor, "Granting item should be on the actor");
        await grantingOnActor.delete();

        actor = game.actors.get(actor.id);
        const stillPresent = actor.items.find(i => i.type === "ability" && i.slug === "adaptability");
        assertEqual(stillPresent, undefined, "Granted ability should be removed after cascade delete");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
