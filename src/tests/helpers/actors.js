import { findItemInCompendium } from "../../util/misc.js";
import { currentTestContext } from "../runner.js";

/** Prefix used on all test-created actors, for easy identification. */
const TEST_ACTOR_PREFIX = "[TEST]";

/**
 * Returns a name for a test document. If a test is currently running, the name
 * includes a short version of the test name for easy identification in Foundry.
 * @param {string} fallback - Base name used when no test context is active.
 */
function testName(fallback) {
    if (!currentTestContext) return `${TEST_ACTOR_PREFIX} ${fallback}`;
    // Keep the name short but recognisable: use up to 40 chars of the test name.
    const short = currentTestContext.name.slice(0, 40);
    return `${TEST_ACTOR_PREFIX} ${short}`;
}

/**
 * Creates a minimal Pokemon actor and adds a species item from the compendium.
 *
 * @param {string} [speciesSlug="rattata"] - The slug (or name) of the species.
 * @param {object} [actorData={}] - Additional data merged into the actor creation payload.
 * @returns {Promise<PTUPokemonActor>}
 */
async function createTestPokemon(speciesSlug = "rattata", actorData = {}) {
    const actor = await Actor.create(foundry.utils.mergeObject({
        name: testName(speciesSlug),
        type: "pokemon",
    }, actorData));
    if (!actor) throw new Error(`Failed to create test pokemon actor for species "${speciesSlug}"`);

    const species = await findItemInCompendium({ type: "species", name: speciesSlug });
    if (!species) {
        await actor.delete();
        throw new Error(`Species "${speciesSlug}" not found in the species compendium. Make sure the pack is loaded.`);
    }

    await actor.createEmbeddedDocuments("Item", [species.toObject()]);

    // Re-fetch the updated actor from the world collection so our reference has the latest data.
    return game.actors.get(actor.id) ?? actor;
}

/**
 * Creates a minimal Pokemon actor WITHOUT adding a species item.
 * Useful for tests that only exercise rule elements that don't require species data
 * (e.g. AELike, RollOption, FlatModifier synthetic checks).
 *
 * @param {object} [actorData={}]
 * @returns {Promise<PTUPokemonActor>}
 */
async function createTestPokemonNoSpecies(actorData = {}) {
    const actor = await Actor.create(foundry.utils.mergeObject({
        name: testName("no-species"),
        type: "pokemon",
    }, actorData));
    if (!actor) throw new Error("Failed to create test pokemon actor (no species)");
    return game.actors.get(actor.id) ?? actor;
}

/**
 * Creates a minimal Trainer/Character actor.
 *
 * @param {object} [actorData={}]
 * @returns {Promise<PTUTrainerActor>}
 */
async function createTestTrainer(actorData = {}) {
    const actor = await Actor.create(foundry.utils.mergeObject({
        name: testName("trainer"),
        type: "character",
    }, actorData));
    if (!actor) throw new Error("Failed to create test trainer actor");
    return game.actors.get(actor.id) ?? actor;
}

/**
 * Deletes a test actor if it still exists in the world.
 * Silently ignores already-deleted actors.
 *
 * @param {Actor|null|undefined} actor
 */
async function deleteTestActor(actor) {
    if (!actor?.id) return;
    const existing = game.actors.get(actor.id);
    if (existing) await existing.delete();
}

export { createTestPokemon, createTestPokemonNoSpecies, createTestTrainer, deleteTestActor, TEST_ACTOR_PREFIX };
