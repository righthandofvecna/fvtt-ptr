import { applyPostAttackEffects, buildItemDomains } from "../rules/pipeline.js";

/**
 * Send a "Usage" chat message for items and moves that don't roll dice.
 *
 * This message serves as the "last step" anchor for apply-effects Rule Elements on
 * moves that have neither an attack roll nor a damage roll (e.g. self-targeting
 * status moves, potions, edges, features). It displays the item's name, effect text,
 * and tags, and provides an "Apply Effects" button that triggers ApplyEffect REs.
 *
 * @param {object} params
 * @param {PTUItem} params.item   The item being used.
 * @param {PTUActor} params.actor The actor using the item.
 */
async function sendUsageMessage({ item, actor }) {
    const tags = [];
    if (item.system.frequency?.type) {
        tags.push({ slug: "frequency", label: game.i18n.localize("PTU.Tags.Frequency"), value: item.system.frequency.type });
    }
    if (item.system.range) {
        tags.push({ slug: "range", label: game.i18n.localize("PTU.Tags.Range"), value: item.system.range });
    }

    // Build flavor header (item name + type/category images for moves).
    const flavorParts = [];

    if (item.type === "move") {
        const typeAndCategoryHeader = document.createElement("div");
        typeAndCategoryHeader.classList.add("header-bar", "type-category");

        const categoryDiv = document.createElement("div");
        categoryDiv.classList.add("type-img");
        const categoryImg = document.createElement("img");
        categoryImg.src = `/systems/ptu/static/css/images/categories/${item.system.category}.png`;
        categoryDiv.append(categoryImg);

        const typeDiv = document.createElement("div");
        typeDiv.classList.add("type-img");
        const typeImg = document.createElement("img");
        typeImg.src = CONFIG.PTU.data.typeEffectiveness[item.system.type]?.images?.bar ?? "";
        typeDiv.append(typeImg);

        typeAndCategoryHeader.append(categoryDiv, typeDiv);
        flavorParts.push(typeAndCategoryHeader.outerHTML);
    }

    const headerDiv = document.createElement("div");
    headerDiv.classList.add("header-bar");
    if (item.img) {
        const img = document.createElement("img");
        img.classList.add("item-img", "item-icon");
        img.src = item.img;
        headerDiv.append(img);
    }
    const h3 = document.createElement("h3");
    h3.classList.add("action");
    h3.textContent = item.name;
    headerDiv.append(h3);
    flavorParts.unshift(headerDiv.outerHTML);

    const content = await foundry.applications.handlebars.renderTemplate(
        "systems/ptu/static/templates/chat/usage.hbs",
        { item, tags }
    );

    const speaker = ChatMessage.getSpeaker({ actor });

    await ChatMessage.create({
        content,
        flavor: flavorParts.join(""),
        speaker,
        flags: {
            ptu: {
                context: { type: "usage" },
                origin: {
                    item: item.uuid,
                    actor: actor.uuid,
                },
            },
        },
    });
}

/**
 * Apply ApplyEffect rule elements from a usage message (no-roll path).
 * Applies effects to currently targeted tokens (or all controlled tokens if no targets).
 *
 * @param {object} params
 * @param {ChatMessage} params.message  The usage chat message.
 */
async function applyEffectsFromUsage({ message }) {
    const originUUID = message.flags?.ptu?.origin?.actor;
    const itemUUID  = message.flags?.ptu?.origin?.item;

    const originActor = originUUID ? await fromUuid(originUUID) : null;
    const item        = itemUUID   ? await fromUuid(itemUUID)   : null;

    if (!originActor) return;

    const messageOptions = message.flags.ptu.context?.options ?? [];

    const itemDomains = buildItemDomains(item, "apply-effects");
    const domains = ["apply-effects", ...itemDomains];

    // Targets: prefer user targets, fall back to controlled tokens.
    // Usage messages have no attack roll, so there is no hit/miss outcome.
    const rawTargets = game.user.targets.size > 0
        ? [...game.user.targets]
        : (canvas.tokens?.controlled ?? []);

    const targets = rawTargets
        .map(token => ({ actor: token.actor ?? token }))
        .filter(t => t.actor);

    await applyPostAttackEffects({
        origin: originActor,
        item,
        targets,
        targetDomains: domains,
        originDomains: domains,
        messageOptions,
        roll: 0,
    });
}

export { sendUsageMessage, applyEffectsFromUsage };
