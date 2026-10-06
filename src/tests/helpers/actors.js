import { findItemInCompendium } from "../../util/misc.js";

/** Prefix used on all test-created actors, for easy identification. */
const TEST_ACTOR_PREFIX = "[TEST]";

/**
 * Creates a minimal Pokemon actor and adds a species item from the compendium.
 *
 * @param {string} [speciesSlug="rattata"] - The slug (or name) of the species.
 * @param {object} [actorData={}] - Additional data merged into the actor creation payload.
 * @returns {Promise<PTUPokemonActor>}
 */
async function createTestPokemon(speciesSlug = "rattata", actorData = {}) {
    const actor = await Actor.create(foundry.utils.mergeObject({
        name: `${TEST_ACTOR_PREFIX} ${speciesSlug}`,
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
        name: `${TEST_ACTOR_PREFIX} no-species`,
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
        name: `${TEST_ACTOR_PREFIX} trainer`,
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
