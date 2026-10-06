import { sluggify } from "../../util/misc.js";

/**
 * Adds an embedded "effect" item with the given rule elements to the actor.
 *
 * @param {PTUActor} actor
 * @param {object[]} rules - Array of rule element source objects (e.g. [{ key: "ActiveEffectLike", ... }]).
 * @param {object} [options]
 * @param {string} [options.name="[TEST] Effect"]
 * @param {object} [options.extraSystem={}] - Additional system fields to merge.
 * @returns {Promise<PTUItem>} The created embedded item.
 */
async function addEffectWithRules(actor, rules, { name = "[TEST] Effect", extraSystem = {} } = {}) {
    const [created] = await actor.createEmbeddedDocuments("Item", [{
        name,
        type: "effect",
        system: foundry.utils.mergeObject({
            rules,
            duration: { unit: "unlimited" },
            slug: sluggify(name),
            enabled: true,
        }, extraSystem),
    }]);
    return created;
}

/**
 * Adds an embedded item of any type with the given rule elements to the actor.
 *
 * @param {PTUActor} actor
 * @param {string} type - Item type (e.g. "ability", "feat", "effect").
 * @param {object[]} rules
 * @param {object} [options]
 * @param {string} [options.name="[TEST] Item"]
 * @param {object} [options.extraSystem={}]
 * @returns {Promise<PTUItem>}
 */
async function addItemWithRules(actor, type, rules, { name = "[TEST] Item", extraSystem = {} } = {}) {
    const [created] = await actor.createEmbeddedDocuments("Item", [{
        name,
        type,
        system: foundry.utils.mergeObject({
            rules,
            slug: sluggify(name),
            enabled: true,
        }, extraSystem),
    }]);
    return created;
}

export { addEffectWithRules, addItemWithRules };
