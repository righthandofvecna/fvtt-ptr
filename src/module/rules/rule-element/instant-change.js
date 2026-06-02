import { ResolvableValueField } from "../../system/schema-data-fields.js";
import { RuleElementPTU } from "./base.js";

/**
 * InstantChange Rule Element
 *
 * Like ActiveEffectLike, but instead of modifying derived data during preparation, it performs a real
 * actor.update() when a configurable trigger fires. Useful for permanently altering actor data at
 * runtime events such as turn start/end, combat start/end, or after a matching roll.
 *
 * Special clamping is applied automatically for well-known bounded fields:
 *   - system.health.value  → [0, health.max]
 *   - system.spirit.value  → (−∞, spirit.max]  (spirit can be negative = weary state)
 *   - system.tempHp.value  → [0, tempHp.max]
 *   - system.ap.value      → [0, ap.max]
 */
class InstantChangeRuleElement extends RuleElementPTU {
    /** @override */
    static defineSchema() {
        const { fields } = foundry.data;
        return {
            ...super.defineSchema(),
            trigger: new fields.StringField({
                required: true,
                nullable: false,
                choices: [
                    "onCreate",
                    "onDelete",
                    "onTurnStart",
                    "onTurnEnd",
                    "onCombatStart",
                    "onCombatEnd",
                    "onRoundStart",
                    "onRoll",
                ],
                initial: "onTurnStart",
            }),
            /** Selectors matched against check.selectors — only meaningful when trigger is "onRoll". */
            selectors: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, initial: undefined }),
                { required: false, nullable: false, initial: [] }
            ),
            mode: new fields.StringField({
                type: String,
                required: true,
                choices: ["add", "subtract", "remove", "multiply", "downgrade", "upgrade", "override"],
                initial: "add",
            }),
            path: new fields.StringField({
                type: String,
                required: true,
                nullable: false,
                blank: false,
                initial: undefined,
            }),
            value: new ResolvableValueField({ required: true, nullable: true, initial: undefined }),
        };
    }

    /* -------------------------------------------- */
    /* Trigger hooks                                */
    /* -------------------------------------------- */

    /** @override */
    onCreate(actorUpdates) {
        if (this.trigger === "onCreate") this.#applyInstantChange(actorUpdates);
    }

    /** @override */
    onDelete(actorUpdates) {
        if (this.trigger === "onDelete") this.#applyInstantChange(actorUpdates);
    }

    /** @override */
    onTurnStart(actorUpdates) {
        if (this.trigger === "onTurnStart") this.#applyInstantChange(actorUpdates);
    }

    /** @override */
    onTurnEnd(actorUpdates) {
        if (this.trigger === "onTurnEnd") this.#applyInstantChange(actorUpdates);
    }

    /** @override */
    onCombatStart(actorUpdates) {
        if (this.trigger === "onCombatStart") this.#applyInstantChange(actorUpdates);
    }

    /** @override */
    onCombatEnd(actorUpdates) {
        if (this.trigger === "onCombatEnd") this.#applyInstantChange(actorUpdates);
    }

    /** @override */
    onRoundStart(actorUpdates) {
        if (this.trigger === "onRoundStart") this.#applyInstantChange(actorUpdates);
    }

    /** @override */
    async afterRollAsync(check, _rolls) {
        if (this.ignored || this.trigger !== "onRoll") return;

        const selectors = this.selectors ?? [];
        if (selectors.length === 0) return;
        if (!selectors.some(s => check.selectors.includes(s))) return;
        if (!this.test(check.targetOptions)) return;

        const actorUpdates = {};
        this.#applyInstantChange(actorUpdates, { rollOptions: check.targetOptions });
        if (Object.keys(actorUpdates).length > 0) {
            await this.actor.update(actorUpdates);
        }
    }

    /* -------------------------------------------- */
    /* Core logic                                   */
    /* -------------------------------------------- */

    /**
     * Compute the new value and merge it into actorUpdates.
     * @param {Object} actorUpdates  Flat update dict accumulated by the caller.
     * @param {Object} [opts]
     * @param {Set<string>|string[]} [opts.rollOptions]  Override roll options for predicate testing.
     */
    #applyInstantChange(actorUpdates, { rollOptions } = {}) {
        if (this.ignored) return;

        const options = rollOptions
            ? Array.from(rollOptions)
            : Array.from(new Set(this.actor.getRollOptions()));
        if (!this.predicate.test(options)) return;

        const path = this.resolveInjectedProperties(this.path);
        if (!path || /\bundefined\b/.test(path)) return;

        const current = foundry.utils.getProperty(this.actor, path);
        const change = this.resolveValue(this.value);
        let newValue = this.#getNewValue(current, change);
        if (newValue === null || this.ignored) return;

        newValue = this.#postProcessValue(path, newValue);

        foundry.utils.mergeObject(actorUpdates, { [path]: newValue });
    }

    /**
     * Clamp the computed value for fields that have known numeric bounds.
     * @param {string} path     Resolved data path
     * @param {*}      value    Computed value before clamping
     * @returns {*}             Post-processed value
     */
    #postProcessValue(path, value) {
        if (typeof value !== "number") return value;

        const { actor } = this;
        switch (path) {
            case "system.health.value":
                return Math.clamp(value, 0, actor.system.health.max ?? actor.system.health.total ?? value);
            case "system.spirit.value":
                // Spirit can legitimately go below 0 (weary state); only cap at max
                return Math.min(value, actor.system.spirit.max ?? value);
            case "system.tempHp.value":
                return Math.clamp(value, 0, actor.system.tempHp?.max ?? 0);
            case "system.ap.value":
                return Math.clamp(value, 0, actor.system.ap?.max ?? value);
            default:
                return value;
        }
    }

    /**
     * Compute the resulting value from the current actor value, the change, and the chosen mode.
     * This mirrors AELikeRuleElement#getNewValue exactly so the two rule elements behave consistently.
     */
    #getNewValue(current, change) {
        const addOrSubtract = (value) => {
            if (typeof value === "string") {
                const test = Number(value);
                if (!isNaN(test)) value = test;
            }

            const isNumericAdd =
                typeof value === "number" && (typeof current === "number" || current === undefined || current === null);
            const isArrayAdd = Array.isArray(current) && current.every((e) => typeof e === typeof value);

            if (isNumericAdd) {
                return (current ?? 0) + value;
            } else if (isArrayAdd) {
                return value;
            }

            this.failValidation("Invalid path for mode");
            return null;
        };

        switch (this.mode) {
            case "multiply": {
                if (!(typeof change === "number" && (typeof current === "number" || current === undefined))) {
                    this.failValidation("Invalid path for multiply mode");
                    return null;
                }
                return Math.trunc((current ?? 0) * change);
            }
            case "add":
                return addOrSubtract(change);
            case "subtract":
            case "remove": {
                const addedChange =
                    (typeof current === "number" || current === undefined) && typeof change === "number"
                        ? -1 * change
                        : change;
                return addOrSubtract(addedChange);
            }
            case "downgrade": {
                if (!(typeof change === "number" && (typeof current === "number" || current === undefined))) {
                    this.failValidation("Invalid path for downgrade mode");
                    return null;
                }
                return Math.min(current ?? 0, change);
            }
            case "upgrade": {
                if (!(typeof change === "number" && (typeof current === "number" || current === undefined))) {
                    this.failValidation("Invalid path for upgrade mode");
                    return null;
                }
                return Math.max(current ?? 0, change);
            }
            case "override": {
                if (typeof change === "object" && change !== null) {
                    for (const [key, value] of Object.entries(change)) {
                        if (typeof value === "string") change[key] = this.resolveInjectedProperties(value);
                    }
                }
                return change;
            }
            default:
                return null;
        }
    }
}

export { InstantChangeRuleElement };
