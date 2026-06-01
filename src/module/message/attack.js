import { extractApplyEffects } from "../rules/helpers.js";
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
 * Apply ApplyEffect rule elements after an attack-only (no damage) move hits.
 * Called from the "Apply Effects" button on attack messages for status moves.
 * Only processes targets that were not missed.
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

    // Build item-specific domain variants so rules can target a specific move.
    const itemDomains = originItem ? [
        `${originItem.id}-apply-effects`,
        `${originItem.slug}-apply-effects`,
    ] : [];
    if (originItem?.type === "move") {
        itemDomains.push(
            `${originItem.system.category.toLocaleLowerCase(game.i18n.lang)}-apply-effects`,
            `${originItem.system.type.toLocaleLowerCase(game.i18n.lang)}-apply-effects`,
            `${originItem.system.frequency?.type ?? "at-will"}-apply-effects`,
        );
    }

    const domains = ["apply-effects", ...itemDomains];

    // Apply effects to each hit target.
    for (const target of targets) {
        if (!target.actor) continue;
        if (target.outcome === "miss" || target.outcome === "crit-miss") continue;

        const effects = Object.values(
            (await extractApplyEffects({
                affects: "target",
                origin: message.actor,
                target: target.actor,
                item: message.item,
                domains,
                options: messageOptions,
                roll: rollResult,
            })).reduce((acc, e) => {
                if (!acc[e.slug]) acc[e.slug] = e;
                return acc;
            }, {})
        );

        if (effects.length > 0) {
            const newItems = await target.actor.createEmbeddedDocuments("Item", effects);
            if (newItems.length > 0) {
                await ChatMessage.create({
                    content: await foundry.applications.handlebars.renderTemplate(
                        "systems/ptu/static/templates/chat/damage/effects-applied.hbs",
                        { target: target.actor, effects: newItems }
                    ),
                    speaker: ChatMessage.getSpeaker({ actor: target.actor }),
                    whisper: ChatMessage.getWhisperRecipients("GM"),
                });
            }
        }
    }

    // Apply origin-side effects (affects: "origin").
    const originEffects = Object.values(
        (await extractApplyEffects({
            affects: "origin",
            origin: message.actor,
            target: message.actor,
            item: message.item,
            domains,
            options: messageOptions,
            roll: rollResult,
        })).reduce((acc, e) => {
            if (!acc[e.slug]) acc[e.slug] = e;
            return acc;
        }, {})
    );

    if (originEffects.length > 0) {
        const newItems = await message.actor.createEmbeddedDocuments("Item", originEffects);
        if (newItems.length > 0) {
            await ChatMessage.create({
                content: await foundry.applications.handlebars.renderTemplate(
                    "systems/ptu/static/templates/chat/damage/effects-applied.hbs",
                    { target: message.actor, effects: newItems }
                ),
                speaker: ChatMessage.getSpeaker({ actor: message.actor }),
                whisper: ChatMessage.getWhisperRecipients("GM"),
            });
        }
    }

    // Do NOT mark the message resolved — keep the Apply Effects button available
    // for repeated use, consistent with the no-roll usage message behaviour.
}

export { AttackMessagePTU, applyEffectsFromAttack }
