import { extractApplyEffects, extractReminders } from "./helpers.js";

/**
 * Build attack:outcome:* roll options for a given attack outcome string.
 * Crit outcomes fall through into their non-crit equivalents, so both
 * "attack:outcome:crit-hit" and "attack:outcome:hit" are present for a crit.
 *
 * @param {string} outcome  "hit" | "miss" | "crit-hit" | "crit-miss"
 * @returns {string[]}
 */
function buildOutcomeOptions(outcome) {
    const opts = [];
    switch (outcome) {
        case "crit-hit":
            opts.push("attack:outcome:crit-hit");
            // fall through
        case "hit":
            opts.push("attack:outcome:hit");
            break;
        case "crit-miss":
            opts.push("attack:outcome:crit-miss");
            // fall through
        case "miss":
            opts.push("attack:outcome:miss");
            break;
    }
    return opts;
}

/**
 * Build item-specific domain selector strings from a move/item and a suffix.
 * Produces selectors for id, slug, and (for moves) category, type, and frequency.
 *
 * @param {PTUItem|null} item
 * @param {string}       suffix  e.g. "apply-effects", "damage-received", "damage-dealt"
 * @returns {string[]}
 */
function buildItemDomains(item, suffix) {
    if (!item) return [];
    const domains = [];
    if (item.id) domains.push(`${item.id}-${suffix}`);
    if (item.slug) domains.push(`${item.slug}-${suffix}`);
    if (item.type === "move") {
        if (item.system.category) {
            domains.push(`${item.system.category.toLocaleLowerCase(game.i18n.lang)}-${suffix}`);
        }
        if (item.system.type) {
            domains.push(`${item.system.type.toLocaleLowerCase(game.i18n.lang)}-${suffix}`);
        }
        domains.push(`${item.system.frequency?.type ?? "at-will"}-${suffix}`);
    }
    return domains;
}

/**
 * Stamp a shared linkedGroup ID onto any effects flagged as linked by their
 * ApplyEffect rule element (flags.ptu.linked = true).
 *
 * @param {object[]} effects
 * @param {string}   groupId
 */
function stampLinkedGroup(effects, groupId) {
    for (const e of effects) {
        if (foundry.utils.getProperty(e, "flags.ptu.linked")) {
            foundry.utils.setProperty(e, "flags.ptu.linkedGroup", groupId);
        }
    }
}

/**
 * Create embedded Item documents on actor and post a whispered "effects applied"
 * chat message to the GM if any were created.
 *
 * @param {PTUActor} actor
 * @param {object[]} effects  Array of item data objects.
 */
async function createEffectsAndNotify(actor, effects) {
    const newItems = await actor.createEmbeddedDocuments("Item", effects);
    if (newItems.length > 0) {
        await ChatMessage.create({
            content: await foundry.applications.handlebars.renderTemplate(
                "systems/ptu/static/templates/chat/damage/effects-applied.hbs",
                { target: actor, effects: newItems }
            ),
            speaker: ChatMessage.getSpeaker({ actor }),
            whisper: ChatMessage.getWhisperRecipients("GM"),
        });
    }
}

/**
 * Post-attack effect application pipeline.
 *
 * This is the single authoritative place for post-attack effect logic. Adding a new
 * cross-cutting concern (new roll options, new synthetic types) only requires editing
 * this function — both the status-move path (attack.js) and the damaging-move path
 * (damage.js) call it.
 *
 * What this function does per call:
 *   1. Injects attack:outcome:* roll options for each target.
 *   2. Extracts ApplyEffect synthetics for each target, stamps linked-group IDs,
 *      creates embedded documents, and posts "effects applied" whispers to GMs.
 *   3. Fires Reminder rule elements for each target (target side).
 *   4. Repeats steps 2-3 for the origin (using combined outcome options from all targets).
 *
 * @param {object}   params
 * @param {PTUActor} params.origin             The attacking actor.
 * @param {PTUItem}  [params.item]             The move or item used.
 * @param {Array<{ actor: PTUActor, createOn?: PTUActor, outcome: string }>} params.targets
 *   - actor:    The actor whose synthetics are queried for effect extraction.
 *   - createOn: The actor that receives createEmbeddedDocuments (defaults to actor).
 *               Pass a contextual clone here when the damage path has already built one.
 *   - outcome:  "hit" | "miss" | "crit-hit" | "crit-miss"
 * @param {string[]} params.targetDomains      Selectors for target-side extractions.
 * @param {string[]} params.originDomains      Selectors for origin-side extractions.
 * @param {string[]} params.messageOptions     Roll options from the originating chat message.
 * @param {number}   [params.roll]             The accuracy roll result forwarded to extractors.
 * @param {string}   [params.linkedGroupId]    Shared ID for linked-effect grouping; auto-generated if omitted.
 */
async function applyPostAttackEffects({
    origin,
    item,
    targets,
    targetDomains,
    originDomains,
    messageOptions,
    roll,
    linkedGroupId,
}) {
    linkedGroupId ??= foundry.utils.randomID();
    const optionsAddedByTargets = {};



    // ── Per-target effects ──────────────────────────────────────────────────
    for (const { actor, createOn, outcome } of targets) {
        if (!actor) continue;


        const outcomeOptions = buildOutcomeOptions(outcome);
        for (const o of outcomeOptions) optionsAddedByTargets[o] = true;
        const targetOptions = [...messageOptions, ...outcomeOptions];

        // ApplyEffect (target side)
        const effects = await extractApplyEffects({
                affects: "target",
                origin,
                target: actor,
                item,
                domains: targetDomains,
                options: targetOptions,
                roll,
            });
        stampLinkedGroup(effects, linkedGroupId);
        if (effects.length > 0) await createEffectsAndNotify(createOn ?? actor, effects);

        // Reminder (target side)
        try {
            const reminders = (await extractReminders({
                affects: "target",
                origin,
                target: actor,
                item,
                domains: targetDomains,
                options: targetOptions,
                roll,
            })).filter(Boolean);
            for (const r of reminders) await ChatMessage.create(r);
        } catch (err) {
            console.error("PTU | Failed to create target reminder messages:", err);
        }
    }

    // ── Origin-side effects ─────────────────────────────────────────────────
    // Merge all outcome options seen across targets so the origin can react to any of them.
    const originOptions = [...messageOptions, ...Object.keys(optionsAddedByTargets)];

    const originEffects = await extractApplyEffects({
            affects: "origin",
            origin,
            target: origin,
            item,
            domains: originDomains,
            options: originOptions,
            roll,
        });
    stampLinkedGroup(originEffects, linkedGroupId);
    if (originEffects.length > 0) await createEffectsAndNotify(origin, originEffects);

    // Reminder (origin side)
    try {
        const reminders = (await extractReminders({
            affects: "origin",
            origin,
            target: targets[0]?.actor ?? origin,
            item,
            domains: originDomains,
            options: originOptions,
            roll,
        })).filter(Boolean);
        for (const r of reminders) await ChatMessage.create(r);
    } catch (err) {
        console.error("PTU | Failed to create origin reminder messages:", err);
    }
}

export {
    buildOutcomeOptions,
    buildItemDomains,
    stampLinkedGroup,
    createEffectsAndNotify,
    applyPostAttackEffects,
};
