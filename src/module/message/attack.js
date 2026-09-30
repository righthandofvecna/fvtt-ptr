import { applyPostAttackEffects, buildItemDomains } from "../rules/pipeline.js";
import { ChatMessagePTU } from "./base.js";

class AttackMessagePTU extends ChatMessagePTU {
    async renderAttackHTML($html) {
        const resolved = this.flags?.ptu?.resolved ?? null;
        if(!resolved) return await this._renderButton($html);

        return $html;
    }

    async _renderButton($html) {
        if(!this.attack) return $html;
        return this.attack.isDamaging ? await this._renderDamageButton($html) : await this._renderUseButton($html);
    }

    async _renderDamageButton($html) {
        const $last = $html.find(".dice-roll").last();
        const $parent = $last.parent();

        const $content = $("<div></div>")
            .addClass("flavor-text")
            .addClass("pb-1")
            .append(
                $("<div></div>")
                .addClass("message-buttons")
                .append(
                    $("<button></button>")
                        .addClass("button")
                        .data("action", "damage")
                        .attr("title", game.i18n.localize("PTU.Action.Damage"))
                        .text(game.i18n.localize("PTU.Action.Damage"))
                        .prepend(
                            $("<i></i>")
                                .addClass("fas fa-heart-broken")
                        )
                        .click(this._executeDamage.bind(this))
                )
            );

        $parent.append($content);
        return $html;
    }

    async _renderUseButton($html) {
        const $last = $html.find(".dice-roll").last();
        const $parent = $last.parent();

        const $content = $("<div></div>")
            .addClass("flavor-text")
            .addClass("pb-1")
            .append(
                $("<div></div>")
                .addClass("message-buttons")
                .append(
                    $("<button></button>")
                        .addClass("button")
                        .attr("title", game.i18n.localize("PTU.Action.ApplyEffects"))
                        .text(game.i18n.localize("PTU.Action.ApplyEffects"))
                        .prepend(
                            $("<i></i>")
                                .addClass("fas fa-sparkles")
                        )
                        .click(() => applyEffectsFromAttack({ message: this, targets: this.targets }))
                )
            );

        $parent.append($content);
        return $html;
    }

    async _executeDamage(event) {
        event.preventDefault();

        const params = {
            event,
            options: this.context.options ?? [],
            rollResult: this.context.rollResult ?? null,
            actor: this.actor,
            targets: this.targets,
            callback: () => {
                const resolved = this.targets.length > 0
                ? game.settings.get("ptu", "autoRollDamage")
                : false;
                if(resolved != this.flags.ptu.resolved) {
                    return this.update({
                        "flags.ptu.resolved": resolved,
                    })
                }
            }
        }

        return await this.attack?.damage(params)
    }
}

/**
 * Apply ApplyEffect rule elements after an attack-only (no damage) move is used.
 * Called from the "Apply Effects" button on attack messages for status moves.
 *
 * All targets (including misses) are passed through the pipeline. ApplyEffect
 * rule elements should use attack:outcome:hit / attack:outcome:miss predicates
 * to gate on the attack result.
 *
 * @param {object} params
 * @param {AttackMessagePTU} params.message
 * @param {Array<{actor: Actor, token: TokenDocument, outcome: string}>} params.targets
 */
async function applyEffectsFromAttack({ message, targets }) {
    if (!message.actor) return;

    const messageOptions = message.flags.ptu.context?.options ?? [];
    const rollResult = message.flags.ptu.context?.rollResult ?? 0;

    const originAttackOptions = message.flags.ptu.attack ?? {};
    const originItem = (await fromUuid(originAttackOptions.actor))?.items.get(originAttackOptions.id) ?? null;

    const itemDomains = buildItemDomains(originItem, "apply-effects");
    const domains = ["apply-effects", ...itemDomains];

    await applyPostAttackEffects({
        origin: message.actor,
        item: message.item,
        targets: targets.filter(t => t.actor),
        targetDomains: domains,
        originDomains: domains,
        messageOptions,
        roll: rollResult,
    });

    // Do NOT mark the message resolved — keep the Apply Effects button available
    // for repeated use, consistent with the no-roll usage message behaviour.
}

export { AttackMessagePTU, applyEffectsFromAttack }
