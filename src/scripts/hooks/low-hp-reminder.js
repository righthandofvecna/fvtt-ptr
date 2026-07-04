const HEALING_KEYWORDS = ["Medicine", "Healing"];

/**
 * Returns all items/moves/feats with Medicine or Healing keywords owned by an actor.
 * @param {PTUActor} actor
 * @returns {PTUItem[]}
 */
function getHealingItems(actor) {
    return actor.items.filter(
        (item) =>
            Array.isArray(item.system.keywords) &&
            item.system.keywords.some((k) => HEALING_KEYWORDS.includes(k))
    );
}

/**
 * Escape a string for safe use as an HTML attribute value (double-quoted).
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Build a data-tooltip attribute value in the effect-popup format used by the Token Panel.
 * @param {PTUItem} item
 * @returns {string}
 */
function buildTooltip(item) {
    const effect = item.system.snippet || item.system.effect || "";
    const keywords = Array.isArray(item.system.keywords) ? item.system.keywords : [];
    const keywordHtml = keywords
        .map((k) => `<div class='effect-range'>${escapeAttr(k)}</div>`)
        .join("");
    const header = keywordHtml ? `<div class='d-flex justify-content-center'>${keywordHtml}</div>` : "";
    const body = effect ? `<div class='effect-effect'>${escapeAttr(effect)}</div>` : "";
    return escapeAttr(`<div class='effect-popup'>${header}${body}</div>`);
}

/**
 * Build and send a whispered low-HP reminder for the given actor.
 * For Pokémon, also includes the trainer's Medicine/Healing items.
 * Buttons in the message will target the low-HP actor's token then use the item.
 * @param {PTUActor} actor
 */
async function sendLowHpReminder(actor) {
    const hp = actor.system.health.value;
    const maxHp = actor.system.health.max;
    const percent = actor.system.health.percent;

    let content = `<p><strong>${actor.name}</strong> is at ${hp}/${maxHp} HP (${percent}%).</p>`;
    content += `<p><em>You're running out of steam! You may wish to use a healing item or move!</em></p>`;

    // Collect items: always include the actor's own; for Pokémon also include the trainer's
    /** @type {Array<{owner: string, item: PTUItem}>} */
    const entries = [];

    for (const item of getHealingItems(actor)) {
        entries.push({ owner: actor.name, item });
    }

    if (actor.type === "pokemon") {
        const trainer = actor.trainer ?? null;
        if (trainer) {
            for (const item of getHealingItems(trainer)) {
                entries.push({ owner: trainer.name, item });
            }
        }
    }

    if (entries.length > 0) {
        const lines = entries.map(({ owner, item }) => {
            const imgTag = `<img src="${item.img}" style="width:16px;height:16px;border:none;vertical-align:middle;margin-right:4px;object-fit:contain;" />`;
            const tooltip = buildTooltip(item);
            return (
                `<li><strong>${owner}:</strong> ` +
                `<button class="button ptu-use-healing-item" ` +
                `data-actor-uuid="${actor.uuid}" data-item-uuid="${item.uuid}" ` +
                `data-tooltip="${tooltip}" data-tooltip-direction="UP">` +
                `${imgTag}${item.name}</button></li>`
            );
        });
        content += `<ul style="list-style:none;padding:0;">${lines.join("")}</ul>`;
    } else {
        content += `<p><em>No healing items or moves found.</em></p>`;
    }

    const whisperRecipients = game.users
        .filter((u) => actor.testUserPermission(u, "OWNER"))
        .map((u) => u.id);

    await ChatMessage.create({
        content,
        whisper: whisperRecipients,
        speaker: ChatMessage.getSpeaker({ actor }),
        flags: { ptu: { lowHpReminder: true } },
    });
}

export const LowHpReminder = {
    listen() {
        // Wire up click handlers when a low-HP reminder message is rendered
        Hooks.on("renderChatMessageHTML", (_message, html) => {
            if (!_message.flags?.ptu?.lowHpReminder) return;

            html.querySelectorAll("button.ptu-use-healing-item").forEach((btn) => {
                btn.addEventListener("click", async (event) => {
                    event.preventDefault();
                    const actorUuid = btn.dataset.actorUuid;
                    const itemUuid = btn.dataset.itemUuid;

                    // Target the low-HP actor's first active token so item.use() picks it up
                    const targetActor = actorUuid ? await fromUuid(actorUuid) : null;
                    const token = targetActor?.getActiveTokens(true)?.[0] ?? null;
                    if (token) {
                        token.setTarget(true, { user: game.user, releaseOthers: true });
                    }

                    // Use the item (consume + send usage message / roll)
                    const item = itemUuid ? await fromUuid(itemUuid) : null;
                    await item?.use?.();
                });
            });
        });

        // Fire the reminder only when HP is reduced below 50%
        Hooks.on("updateActor", async (actor, changes, options, userId) => {
            // Only process on the client that triggered the update to avoid duplicates
            if (userId !== game.user.id) return;

            // Respect the per-user setting
            if (!game.settings.get("ptu", "lowHpReminder")) return;

            // Only care about trainer and Pokémon actors
            if (!["character", "pokemon"].includes(actor.type)) return;

            // Only fire when HP value was part of this update
            if (!foundry.utils.hasProperty(changes, "system.health.value")) return;

            // Only remind when HP was actually reduced (not healed or unchanged)
            const oldHp = options.ptu?.[actor.id]?.oldHpValue ?? null;
            if (oldHp === null) return;
            const newHp = foundry.utils.getProperty(changes, "system.health.value");
            if (newHp >= oldHp) return;

            // Only remind when the new HP is below 50%
            const max = actor.system.health.max ?? 0;
            if (max <= 0) return;
            if (actor.system.health.percent >= 50) return;

            await sendLowHpReminder(actor);
        });
    },
};
