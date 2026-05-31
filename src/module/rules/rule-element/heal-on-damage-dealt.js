import { RuleElementPTU } from "./base.js";

/**
 * HealOnDamageDealt rule element
 *
 * Registers a synthetic that triggers after damage is applied to a target.
 * The origin (attacker) is healed (or takes recoil) for a percentage of the
 * damage dealt.  Use a positive `percent` for drain moves (Absorb, Drain
 * Punch, …) and a negative `percent` for recoil (Double-Edge, etc.).
 *
 * Example – heal 50 % of damage dealt (Absorb):
 * ```json
 * {
 *   "key": "HealOnDamageDealt",
 *   "selectors": ["damage-dealt"],
 *   "percent": 0.5
 * }
 * ```
 *
 * Example – 25 % recoil:
 * ```json
 * {
 *   "key": "HealOnDamageDealt",
 *   "selectors": ["damage-dealt"],
 *   "percent": -0.25
 * }
 * ```
 */
class HealOnDamageDealtRuleElement extends RuleElementPTU {
    /** @override */
    static defineSchema() {
        const { fields } = foundry.data;

        return {
            ...super.defineSchema(),
            selectors: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, initial: undefined })
            ),
            /** Fraction of damage dealt to heal (negative = recoil). */
            percent: new fields.NumberField({
                required: true,
                nullable: false,
                initial: 0.5,
            }),
            /** Round healing/recoil up instead of down. */
            roundUp: new fields.BooleanField({ required: false, nullable: false, initial: false }),
        };
    }

    /** @override */
    beforePrepareData() {
        if (this.ignored) return;

        const selectors = (this.selectors ?? [])
            .map(s => this.resolveInjectedProperties(s))
            .map(s => s
                .replaceAll("{id}", this.item.id ?? "")
                .replaceAll("{slug}", this.item.slug ?? "")
            )
            .filter(s => !!s);

        if (selectors.length === 0) {
            return this.failValidation("must have at least one selector");
        }

        const healId = `${this.actor.uuid}:${this.item.uuid}:${this.sourceIndex ?? 0}`;

        for (const selector of selectors) {
            const construct = (options = {}) => {
                if (!this.test(options.test ?? this.actor.getRollOptions())) return null;

                const damageTotal = options.damageTotal ?? 0;
                if (damageTotal === 0) return null;

                const raw = damageTotal * this.percent;
                const amount = this.roundUp ? Math.ceil(raw) : Math.floor(raw);
                if (amount === 0) return null;

                return { amount };
            };

            const synthetics = (this.actor.synthetics.healOnDamageDealt ??= {});
            (synthetics[selector] ??= {})[healId] = construct;
        }
    }
}

export { HealOnDamageDealtRuleElement };
