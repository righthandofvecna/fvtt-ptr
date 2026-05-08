import { sluggify } from '../../../util/misc.js';
import { PTUCondition, PTUItem } from '../index.js';
import { PTUAttackCheck } from '../../system/check/attack.js';
import { PTUDamageCheck } from '../../system/check/damage.js';
class PTUMove extends PTUItem {
    get rollable() {
        return !(isNaN(Number(this.system.ac ?? undefined)) && isNaN(Number(this.system.damageBase ?? undefined)));
    }

    get usable() {
        return !this.rollable && this.system.frequency?.type !== "static";
    }

    /** @override */
    get rollOptions() {
        const options = super.rollOptions;
        if(this.isDamaging && this.damageBase.isStab) {
            options.all['move:is-stab'] = true;
            options.item['move:is-stab'] = true;
        }
        if (this.isDamaging && this.damageBase.isStab && !!options.all[`move:damage-base:${this.damageBase.preStab}`]) {
            delete this.flags.ptu.rollOptions.all[`move:damage-base:${this.damageBase.preStab}`];
            delete this.flags.ptu.rollOptions.item[`move:damage-base:${this.damageBase.preStab}`];

            this.flags.ptu.rollOptions.all[`move:damage-base:${this.damageBase.postStab}`] = true;
            this.flags.ptu.rollOptions.item[`move:damage-base:${this.damageBase.postStab}`] = true;

            options.all[`move:damage-base:${this.damageBase.postStab}`] = true;
            options.item[`move:damage-base:${this.damageBase.postStab}`] = true;
        }
        for(const keyword of this.system.keywords) {
            options.all[`move:${sluggify(keyword)}`] = true;
            options.item[`move:${sluggify(keyword)}`] = true;
        }
        return options;
    }

    /** @override */
    get realId() {
        return this.system.isStruggle
            ? `struggle-${this.system.type.toLocaleLowerCase(game.i18n.lang)}-${this.system.category.toLocaleLowerCase(game.i18n.lang)}${this.system.isRangedStruggle ? "-ranged" : ""}`
            : super.realId;
    }

    get isDamaging() {
        return !isNaN(Number(this.system.damageBase ?? undefined));
    }

    get isFiveStrike() {
        return (!!this.rollOptions.item["move:range:five-strike"]) || (!!this.rollOptions.item["move:five-strike"]);
    }

    get damageBase() {
        if (!this.isDamaging) return null;
        const result = {
            preStab: isNaN(Number(this.system.damageBase)) ? 0 : Number(this.system.damageBase),
            postStab: 0,
            isStab: false,
        }
        result.postStab = result.preStab + (!this.system.isStruggle && this.actor?.types.includes(this.system.type) ? 2 : 0);
        result.isStab = result.preStab !== result.postStab;
        return result;
    }

    /**
     * The selector array used by the check system to locate modifiers for this move.
     * Mirrors the logic formerly in PTUActor#prepareAttack().
     */
    get selectors() {
        const selectors = [
            `${this.id}-attack`,
            `${this.slug}-attack`,
            `${this.system.category.toLocaleLowerCase(game.i18n.lang)}-attack`,
            `${this.system.type.toLocaleLowerCase(game.i18n.lang)}-attack`,
            `${this.system.frequency?.type ?? "at-will"}-attack`,
            "attack-roll",
            "attack",
            "all"
        ];
        if (this.system.isStruggle) selectors.push("struggle-attack");

        const rangeType = (() => {
            const range = this.system.range;
            if (range?.includes("Melee")) return "melee";
            if (range?.includes("Self")) return "self";
            return "ranged";
        })();
        if (rangeType) selectors.push(`${rangeType}-attack`);

        return selectors;
    }

    /**
     * @deprecated Access the move item directly instead of going through a wrapper's `.item`.
     * @returns {PTUMove} this
     */
    get item() {
        foundry.utils.logCompatibilityWarning(
            "PTUMove#item is deprecated. The collection now contains PTUMove items directly; use the move itself.",
            { since: "2.0", until: "3.0", stack: false }
        );
        return this;
    }

    /**
     * @deprecated Use move.name directly.
     * @returns {string}
     */
    get label() {
        foundry.utils.logCompatibilityWarning(
            "PTUMove#label is deprecated. Use move.name instead.",
            { since: "2.0", until: "3.0", stack: false }
        );
        return this.name;
    }

    /**
     * Roll an accuracy check for this move, running the full PTUAttackCheck pipeline.
     * @param {object} [params={}]
     * @param {Event}   [params.event]
     * @param {any[]}   [params.targets]
     * @param {any}     [params.token]
     * @param {Function} [params.callback]
     * @returns {Promise<AttackRoll|null>}
     */
    async roll(params = {}) {
        const actor = this.actor;
        if (!actor) return null;

        const attackRollOptions = this.getRollOptions("attack");
        const rollOptions = [...actor.getRollOptions(this.selectors), ...attackRollOptions];

        const check = new PTUAttackCheck({
            source: {
                actor,
                item: this,
                token: params.token ?? null,
                options: rollOptions
            },
            targets: params.targets ?? [...game.user.targets],
            selectors: this.selectors,
            event: params.event,
        });

        return await check.executeAttack(params.callback ?? null, null);
    }

    /**
     * Roll damage for this move, running the full PTUDamageCheck pipeline.
     * @param {object} [params={}]
     * @param {Event}   [params.event]
     * @param {any[]}   [params.targets]  Array of {actor, token, outcome} objects from a prior attack message.
     * @param {any}     [params.token]
     * @param {string[]} [params.options]
     * @param {number}  [params.rollResult]
     * @param {Function} [params.callback]
     * @returns {Promise<DamageRoll|null>}
     */
    async damage(params = {}) {
        const actor = this.actor;
        if (!actor) return null;

        const domains = this.selectors.map(s => s.replace("attack", "damage"));
        const accuracyRollResult = params.rollResult;

        const preTargets = params.targets?.length > 0 ? params.targets : [...game.user.targets];
        const targets = [];
        let outcomes = {};
        if (preTargets.length > 0 && !(preTargets[0] instanceof Actor)) {
            for (const target of preTargets) {
                if (!target.token?.object) continue;
                targets.push(target.token.object);
                outcomes[target.token.actorId] = target.outcome;
            }
            if (targets.length === 0) {
                targets.push(...game.user.targets);
                outcomes = null;
            }
        }

        const check = new PTUDamageCheck({
            source: {
                actor,
                item: this,
                token: params.token ?? null,
                options: params.options ?? []
            },
            targets,
            outcomes,
            selectors: domains,
            event: params.event,
            accuracyRollResult
        });

        return await check.executeDamage(params.callback ?? null, null);
    }

    /** @override */
    prepareBaseData() {
        super.prepareBaseData();

        const rollOptions = {
            all: {
                [`move:type:${sluggify(this.system.type)}`]: true,
                [`move:category:${sluggify(this.system.category)}`]: true,
                [`move:frequency:${this.system.frequency?.type ?? "at-will"}`]: true,
            },
        }

        const ranges = this.system.range?.split(",").map(r => r.trim()) ?? [];
        for (const range of ranges) {
            rollOptions.all[`move:range:${sluggify(range)}`] = true;
        }

        if (this.isDamaging) {
            rollOptions.all[`move:damage-base:${this.damageBase.postStab}`] = true;
            rollOptions.all[`move:damage-base:pre-stab:${this.damageBase.preStab}`] = true;
        }
        if (!isNaN(Number(this.system.ac))) rollOptions.all[`move:ac:${this.system.ac}`] = true;
        rollOptions.item = rollOptions.all;

        this.flags.ptu = foundry.utils.mergeObject(this.flags.ptu, {rollOptions});
        this.flags.ptu.rollOptions.attack = Object.keys(this.flags.ptu.rollOptions.all).reduce((obj, key) => {
            obj[key.replace("move:", "attack:").replace("item:", "attack:")] = true;
            return obj;
        }, {});
    }

    /** @override */
    getRollOptionsWithTarget(target, domains = []) {
        if (!target) return [];
        const toReturn = new Set();
        
        // calculate effectiveness
        const effectiveness = target?.iwr?.all?.[sluggify(this.system.type)] ?? 1;
        if (effectiveness > 1) {
            toReturn.add("move:super-effective");
        } else if (effectiveness < 1) {
            toReturn.add("move:not-very-effective");
        }
        
        return Array.from(new Set(toReturn)).sort();
    }

    /** @override */
    async use(options = {}) {
        // Rollable moves: run the attack check, then optionally chain damage.
        if (this.rollable) {
            return await this.roll({
                event: options.event,
                targets: options.targets,
                token: options.token,
                callback: async (rolls, targets, msg, event) => {
                    await this.consume();

                    if (!game.settings.get("ptu", "autoRollDamage")) return;
                    if (!this.isDamaging) return;

                    const params = {
                        event,
                        options: msg.context?.options ?? [],
                        actor: msg.actor,
                        targets: msg.targets,
                        rollResult: msg.context?.rollResult ?? null,
                    };
                    const result = await this.damage(params);
                    if (result === null) {
                        await msg.update({ "flags.ptu.resolved": false });
                    }
                }
            });
        }

        if (this.system.frequency?.type === "static") return;

        let didSomething = false;
        const conditions = new Set(this.actor.getFilteredRollOptions("condition"))
        if (conditions.has("condition:confused")) {
            await PTUCondition.HandleConfusion(this, this.actor);
            didSomething = true;
        }

        if (this.referenceEffect) {
            const results = [];
            const effect = await fromUuid(this.referenceEffect);
            if (this.range.includes("Self")) {
                const result = await effect.apply([this.actor], this.actor);
                if (result) results.push(...result);
            }
            else {
                const targets = options.targets || [...game.user.targets] || canvas.tokens.controlled;
                const result = await effect.apply(targets, this.actor);
                if (result) results.push(...result);
            }

            if (results.length > 0) {
                const statements = results.map((effect) =>
                    game.i18n.format("PTU.Broadcast.ApplyEffect", { actor: effect.actor.link, effect: effect.link, source: this.actor.link })
                ).filter(s => s).join("<br/>")
                const enrichedHtml = await foundry.applications.ux.TextEditor.implementation.enrichHTML(statements, { async: true })
                const chatData = {
                    user: game.user.id,
                    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                    content: await foundry.applications.handlebars.renderTemplate("systems/ptu/static/templates/chat/effect-applied.hbs", { statements: enrichedHtml }),
                    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
                    whisper: this.actor.hasPlayerOwner ? [game.user.id] : game.users.filter(u => u.isGM).map(u => u.id),
                };
                await ChatMessage.create(chatData);
                didSomething = true;
            }
        }

        if (!didSomething) {
            ui.notifications.warn(game.i18n.localize("PTU.Notifications.NoEffect"));
        }
    }
}

export { PTUMove }