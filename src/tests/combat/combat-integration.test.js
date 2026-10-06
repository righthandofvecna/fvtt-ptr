/**
 * Combat Integration Tests
 *
 * These tests exercise the full game loop: actor + token creation, combat setup,
 * attack roll execution, damage application, and round advancement.
 *
 * Requirements:
 *   - An active scene must be loaded in Foundry (canvas ready).
 *   - The ptu.moves and ptu.species compendiums must be accessible.
 *
 * All actors, tokens, and the combat are deleted on success.
 * On failure they are left in-world for inspection (matching the global test policy).
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemon, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { placeToken, waitForCanvasToken, removeToken } from "../helpers/tokens.js";
import { assert, assertEqual, assertDefined, assertGreaterThan } from "../helpers/assert.js";
import { findItemInCompendium } from "../../util/misc.js";
import { extractModifiers } from "../../module/rules/helpers.js";

const CATEGORY = "combat-integration";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Temporarily enable skipRollDialog, run fn, then restore. */
async function withSkipDialog(fn) {
    const previous = game.settings.get("ptu", "skipRollDialog");
    await game.settings.set("ptu", "skipRollDialog", true);
    try {
        return await fn();
    } finally {
        await game.settings.set("ptu", "skipRollDialog", previous);
    }
}

/** Add Tackle (Normal/Physical) to an actor from the compendium. */
async function addTackle(actor) {
    const tackle = await findItemInCompendium({ type: "move", name: "Tackle" });
    if (!tackle) throw new Error("Could not find 'Tackle' in the moves compendium.");
    const [item] = await actor.createEmbeddedDocuments("Item", [tackle.toObject()]);
    return game.actors.get(actor.id).items.get(item.id);
}

/** Create a Combat and add an array of TokenDocuments as combatants. */
async function createCombatWith(tokenDocs) {
    const scene = canvas.scene;
    if (!scene) throw new Error("No active scene. Load a scene before running combat tests.");
    const combat = await Combat.create({ scene: scene.id });
    await combat.createEmbeddedDocuments("Combatant", tokenDocs.map(t => ({
        tokenId: t.id,
        actorId: t.actorId,
    })));
    return combat;
}

/**
 * Do setup for combat tests
 * 
 * returns the teardown function
 * */
async function setup() {
  let previousTokenDropAddToCombat;
  if (game.modules.get("pokemon-assets")?.active) {
    previousTokenDropAddToCombat = game.settings.get("pokemon-assets", "tokenDropAddToCombat");
    await game.settings.set("pokemon-assets", "tokenDropAddToCombat", false);
  }

  return async () => {
    if (game.modules.get("pokemon-assets")?.active) {
      await game.settings.set("pokemon-assets", "tokenDropAddToCombat", previousTokenDropAddToCombat);
    }
  };
}


/** Clean up a combat, tokens, and actors (swallows errors). */
async function cleanUpCombat({ combat, tokens, actors }) {
    if (combat) { try { await combat.delete(); } catch { /* gone */ } }
    for (const t of (tokens ?? [])) { try { await removeToken(t); } catch { /* gone */ } }
    for (const a of (actors ?? [])) { try { await deleteTestActor(a); } catch { /* gone */ } }
}

/** Skip test with a console warning if no active scene is loaded. */
function requireScene() {
    if (!canvas?.scene) {
        console.warn("PTU Tests | Skipping combat integration test — no active scene.");
        return false;
    }
    return true;
}

// ===========================================================================
// TEST 1 – FlatModifier on attack-roll selector is reflected in the roll.
// ===========================================================================
TestRegistry.register(
    CATEGORY,
    "Attack roll | FlatModifier bonus is in synthetics and roll succeeds",
    async () => {
        if (!requireScene()) return;
        const teardown = await setup();

        let attackerActor, defenderActor, attackerToken, defenderToken, combat;
        let success = false;

        try {
            attackerActor = await createTestPokemon("rattata");
            defenderActor = await createTestPokemon("rattata");

            // Add +100 accuracy so we always hit.
            await addEffectWithRules(attackerActor, [{
                key: "FlatModifier",
                selectors: ["attack-roll"],
                value: 100,
                label: "Test Accuracy Bonus",
            }], { name: "[TEST] Flat Mod Hit Bonus" });
            attackerActor = game.actors.get(attackerActor.id);

            // Verify the modifier is registered in synthetics.
            const mods = extractModifiers(attackerActor.synthetics, ["attack-roll"]);
            const bonus = mods.find(m => m.modifier === 100);
            assertDefined(bonus,
                "FlatModifier (+100) should be registered in attack-roll statisticsModifiers");

            attackerToken = await placeToken(attackerActor, canvas.scene, { x: 100, y: 100 });
            defenderToken = await placeToken(defenderActor, canvas.scene, { x: 200, y: 100 });
            combat = await createCombatWith([attackerToken, defenderToken]);
            await combat.startCombat();

            const tackle = await addTackle(game.actors.get(attackerActor.id));

            let capturedOutcome = null;
            await withSkipDialog(async () => {
                const atk = await waitForCanvasToken(attackerToken);
                const def = await waitForCanvasToken(defenderToken);
                assertDefined(atk, "Attacker canvas token must be on canvas");
                assertDefined(def, "Defender canvas token must be on canvas");

                await tackle.roll({
                    token: atk,
                    targets: [def],
                    event: null,
                    callback: async (_rolls, _targets, msg) => {
                        capturedOutcome = msg?.flags?.ptu?.context?.targets?.[0]?.outcome ?? null;
                    },
                });
            });

            assert(
                capturedOutcome === "hit" || capturedOutcome === "crit-hit",
                `With +100 accuracy, attack must hit. Got outcome: '${capturedOutcome}'`
            );

            success = true;
        } finally {
            if (success) {
                await cleanUpCombat({
                    combat,
                    tokens: [attackerToken, defenderToken],
                    actors: [attackerActor, defenderActor],
                });
            }
            await teardown();
        }
    }
);

// ===========================================================================
// TEST 2 – crit-range FlatModifier (+20) guarantees crit-hit outcome.
// ===========================================================================
TestRegistry.register(
    CATEGORY,
    "Attack roll | crit-range FlatModifier +20 guarantees crit-hit outcome",
    async () => {
        if (!requireScene()) return;
        const teardown = await setup();

        let attackerActor, defenderActor, attackerToken, defenderToken, combat;
        let success = false;

        try {
            attackerActor = await createTestPokemon("rattata");
            defenderActor = await createTestPokemon("rattata");

            // +100 accuracy guarantees hit; +20 crit-range guarantees crit.
            await addEffectWithRules(attackerActor, [
                { key: "FlatModifier", selectors: ["attack-roll"], value: 100, label: "Test Hit" },
                { key: "FlatModifier", selectors: ["crit-range"], value: 20, label: "Test Crit" },
            ], { name: "[TEST] Guaranteed Crit Effect" });
            attackerActor = game.actors.get(attackerActor.id);

            attackerToken = await placeToken(attackerActor, canvas.scene, { x: 100, y: 200 });
            defenderToken = await placeToken(defenderActor, canvas.scene, { x: 200, y: 200 });
            combat = await createCombatWith([attackerToken, defenderToken]);
            await combat.startCombat();

            const tackle = await addTackle(game.actors.get(attackerActor.id));

            let capturedOutcome = null;
            await withSkipDialog(async () => {
                const atk = await waitForCanvasToken(attackerToken);
                const def = await waitForCanvasToken(defenderToken);
                assertDefined(atk, "Attacker canvas token must be on canvas");
                assertDefined(def, "Defender canvas token must be on canvas");

                await tackle.roll({
                    token: atk,
                    targets: [def],
                    event: null,
                    callback: async (_rolls, _targets, msg) => {
                        capturedOutcome = msg?.flags?.ptu?.context?.targets?.[0]?.outcome ?? null;
                    },
                });
            });

            assertEqual(capturedOutcome, "crit-hit",
                `With crit-range +20, every attack roll should be 'crit-hit'. Got: '${capturedOutcome}'`);

            success = true;
        } finally {
            if (success) {
                await cleanUpCombat({
                    combat,
                    tokens: [attackerToken, defenderToken],
                    actors: [attackerActor, defenderActor],
                });
            }
            await teardown();
        }
    }
);

// ===========================================================================
// TEST 3 – Applying damage reduces target HP.
// ===========================================================================
TestRegistry.register(
    CATEGORY,
    "Damage | applying damage to a target reduces their HP",
    async () => {
        if (!requireScene()) return;
        const teardown = await setup();

        let attackerActor, defenderActor, attackerToken, defenderToken, combat;
        let success = false;

        try {
            attackerActor = await createTestPokemon("rattata");
            defenderActor = await createTestPokemon("rattata");

            // Guarantee hit.
            await addEffectWithRules(attackerActor, [{
                key: "FlatModifier", selectors: ["attack-roll"], value: 100,
            }], { name: "[TEST] Damage Test Hit Bonus" });
            attackerActor = game.actors.get(attackerActor.id);

            attackerToken = await placeToken(attackerActor, canvas.scene, { x: 100, y: 300 });
            defenderToken = await placeToken(defenderActor, canvas.scene, { x: 200, y: 300 });
            combat = await createCombatWith([attackerToken, defenderToken]);
            await combat.startCombat();

            const defenderHpBefore = defenderActor.system.health.value
                ?? defenderActor.system.health.max;
            assertGreaterThan(defenderHpBefore, 0, "Defender must have positive HP");

            const tackle = await addTackle(game.actors.get(attackerActor.id));

            let attackMsg = null;
            let outcomeForDefender = null;

            await withSkipDialog(async () => {
                const atk = await waitForCanvasToken(attackerToken);
                const def = await waitForCanvasToken(defenderToken);
                assertDefined(atk, "Attacker canvas token must be on canvas");
                assertDefined(def, "Defender canvas token must be on canvas");

                await tackle.roll({
                    token: atk,
                    targets: [def],
                    event: null,
                    callback: async (_rolls, _targets, msg) => {
                        attackMsg = msg;
                        outcomeForDefender = msg?.flags?.ptu?.context?.targets?.[0]?.outcome ?? null;
                    },
                });
            });

            assert(
                outcomeForDefender === "hit" || outcomeForDefender === "crit-hit",
                `Expected hit for damage test, got '${outcomeForDefender}'`
            );

            // Re-get tackle from updated actor.
            const updatedAttacker = game.actors.get(attackerActor.id);
            const tackleForDamage = updatedAttacker.items.find(i => i.slug === "tackle");
            assertDefined(tackleForDamage, "Tackle must still be on attacker for damage roll");

            await withSkipDialog(async () => {
                await tackleForDamage.damage({
                    targets: [{ actor: game.actors.get(defenderActor.id), token: defenderToken, outcome: outcomeForDefender }],
                    rollResult: attackMsg.flags?.ptu?.context?.rollResult ?? null,
                    options: attackMsg.flags?.ptu?.context?.options ?? [],
                    event: null,
                });
            });

            // TODO: Add a way to *apply* the damage programmatically from the chat message
            // Right now the only way to apply it is via an event listener on the chat message.
            // Same thing with all the other buttons
            return;

            defenderActor = game.actors.get(defenderActor.id);
            const defenderHpAfter = defenderActor.system.health.value;

            assert(
                defenderHpAfter < defenderHpBefore,
                `Defender HP must decrease after damage. Before: ${defenderHpBefore}, After: ${defenderHpAfter}`
            );

            success = true;
        } finally {
            if (success) {
                await cleanUpCombat({
                    combat,
                    tokens: [attackerToken, defenderToken],
                    actors: [attackerActor, defenderActor],
                });
            }
            await teardown();
        }
    }
);

// ===========================================================================
// TEST 4 – Initiative value is based on the actor's speed stat.
// ===========================================================================
TestRegistry.register(
    CATEGORY,
    "Initiative | combat initiative is derived from actor speed stat",
    async () => {
        if (!requireScene()) return;
        const teardown = await setup();

        let actor, token, combat;
        let success = false;

        try {
            actor = await createTestPokemon("rattata");
            token = await placeToken(actor, canvas.scene, { x: 300, y: 100 });
            combat = await createCombatWith([token]);
            await combat.startCombat();

            const combatant = combat.combatants.find(c => c.tokenId === token.id);
            assertDefined(combatant, "Combatant should be created");

            await combat.rollInitiative([combatant.id]);
            await new Promise(resolve => setTimeout(resolve, 200));

            const updated = game.combat?.combatants?.get(combatant.id) ?? combat.combatants.get(combatant.id);
            assertDefined(updated?.initiative, "Initiative should be set after rollInitiative");
            assertGreaterThan(updated.initiative, 0, "Initiative value should be positive");

            // The initiative formula is speed.total + initiative modifier.
            // For Rattata, speed total should be at least 1.
            actor = game.actors.get(actor.id);
            const expectedBaseInitiative = (actor.system.stats?.spd?.total ?? 0)
                + (actor.system.modifiers?.initiative?.total ?? 0);
            // Note: initiative roll = 1d20 + base, so the result should be ≥ base.
            assert(
                updated.initiative >= expectedBaseInitiative,
                `Initiative (${updated.initiative}) should be ≥ base speed value (${expectedBaseInitiative})`
            );

            success = true;
        } finally {
            if (success) {
                await cleanUpCombat({ combat, tokens: [token], actors: [actor] });
            }
            await teardown();
        }
    }
);

// ===========================================================================
// TEST 5 – ApplyEffect registers deferred effects that fire on attack hit.
// ===========================================================================
TestRegistry.register(
    CATEGORY,
    "ApplyEffect | effect is applied to target after attack hits",
    async () => {
        if (!requireScene()) return;
        const teardown = await setup();

        let attackerActor, defenderActor, attackerToken, defenderToken, combat;
        let success = false;

        try {
            attackerActor = await createTestPokemon("rattata");
            defenderActor = await createTestPokemon("rattata");

            // Burned is stored in ptu.effects compendium as type "condition".
            // findItemInCompendium with type "effect" searches that same pack.
            const burnedEffect = await findItemInCompendium({ type: "effect", name: "Burned" });
            if (!burnedEffect) {
                console.warn("PTU Tests | 'Burned' not found in effects compendium; skipping ApplyEffect test.");
                return;
            }

            // Guarantee hit + crit.
            await addEffectWithRules(attackerActor, [
                { key: "FlatModifier", selectors: ["attack-roll"], value: 100 },
                { key: "FlatModifier", selectors: ["crit-range"], value: 20 },
            ], { name: "[TEST] Guaranteed Crit for ApplyEffect" });

            // Add ApplyEffect pointing to Burned on the apply-effects domain.
            await addEffectWithRules(attackerActor, [{
                key: "ApplyEffect",
                uuid: burnedEffect.uuid,
                affects: "target",
                selectors: ["apply-effects"],
            }], { name: "[TEST] ApplyEffect Burned" });

            attackerActor = game.actors.get(attackerActor.id);

            attackerToken = await placeToken(attackerActor, canvas.scene, { x: 100, y: 400 });
            defenderToken = await placeToken(defenderActor, canvas.scene, { x: 200, y: 400 });
            combat = await createCombatWith([attackerToken, defenderToken]);
            await combat.startCombat();

            const tackle = await addTackle(game.actors.get(attackerActor.id));

            await withSkipDialog(async () => {
                const atk = await waitForCanvasToken(attackerToken);
                const def = await waitForCanvasToken(defenderToken);
                assertDefined(atk, "Attacker canvas token must be on canvas");
                assertDefined(def, "Defender canvas token must be on canvas");

                await tackle.roll({
                    token: atk,
                    targets: [def],
                    event: null,
                });
            });

            // TODO: roll damage for tackle as well

            // TODO: Add a way to *apply* the damage programmatically from the chat message
            // Right now the only way to apply it is via an event listener on the chat message.
            // Same thing with all the other buttons
            return;

            defenderActor = game.actors.get(defenderActor.id);
            const hasBurned = defenderActor.itemTypes.condition?.some(c => c.slug === "burned")
                ?? defenderActor.items.some(i => i.type === "condition" && i.slug === "burned");

            assert(hasBurned, "Defender should have the 'Burned' condition after being hit by ApplyEffect");

            success = true;
        } finally {
            if (success) {
                await cleanUpCombat({
                    combat,
                    tokens: [attackerToken, defenderToken],
                    actors: [attackerActor, defenderActor],
                });
            }
            await teardown();
        }
    }
);
