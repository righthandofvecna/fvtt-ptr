import { sluggify } from "../../util/misc.js";
import { currentTestContext } from "../runner.js";

/**
 * Returns a descriptive name for a test item, incorporating the current test
 * name when available.
 * @param {string} [fallback="Effect"]
 */
function testItemName(fallback = "Effect") {
    if (!currentTestContext) return `[TEST] ${fallback}`;
    const short = currentTestContext.name.slice(0, 35);
    return `[TEST] ${short}`;
}

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
async function addEffectWithRules(actor, rules, { name, extraSystem = {} } = {}) {
    const effectName = name ?? testItemName();
    const [created] = await actor.createEmbeddedDocuments("Item", [{
        name: effectName,
        type: "effect",
        system: foundry.utils.mergeObject({
            rules,
            duration: { unit: "unlimited" },
            slug: sluggify(effectName),
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
