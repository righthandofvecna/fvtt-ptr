/**
 * Intercepts content-link clicks on Macro documents to inject origin context
 * into the macro's execution scope as a direct local variable.
 *
 * In a macro script, the `context` variable is available directly:
 *   context?.type             // "chat-message" | "item-sheet"
 *   context?.messageId        // ID of the originating chat message
 *   context?.message          // The ChatMessage document
 *   context?.itemId           // ID of the originating item
 *   context?.itemUuid         // UUID of the originating item
 *   context?.item             // The Item document
 *
 * If a macro link is clicked outside of a tracked context, `context` is undefined.
 */

/**
 * Click handler added to Macro content links in tracked contexts.
 * Prevents Foundry's default handler (body-delegated) and re-executes
 * the macro with the provided origin context injected into scope.
 * @param {MouseEvent} event
 * @param {object} context
 */
async function handleMacroLinkClick(event, context) {
    const link = event.currentTarget;
    const uuid = link.dataset?.uuid;
    if (!uuid) return;

    // Only intercept links that resolve to a Macro
    const isMacroLink = uuid.startsWith("Macro.") || link.dataset.type === "Macro";
    if (!isMacroLink) return;

    // Stop propagation before async work so Foundry's body-delegated handler
    // doesn't also fire while we await the UUID resolution
    event.preventDefault();
    event.stopPropagation();

    const macro = await fromUuid(uuid).catch(() => null);
    if (!(macro instanceof Macro)) return;

    return macro.execute({ context, event });
}

export const MacroLinkContext = {
    listen() {
        // --- Chat message context ---
        // Foundry passes (message, html) where html is a plain HTMLElement
        Hooks.on("renderChatMessageHTML", (message, html) => {
            const selector = "a[data-link][data-type='Macro'], a[data-link][data-uuid^='Macro.']";
            for (const link of html.querySelectorAll(selector)) {
                link.addEventListener("click", event => handleMacroLinkClick(event, {
                    type: "chat-message",
                    messageId: message.id,
                    message,
                }));
            }
        });

        // --- Item sheet context ---
        // renderPTUItemSheet passes (sheet, $html) where $html is a jQuery object
        Hooks.on("renderPTUItemSheet", (sheet, $html) => {
            const item = sheet.item;
            const selector = "a[data-link][data-type='Macro'], a[data-link][data-uuid^='Macro.']";
            for (const link of $html.find(selector)) {
                link.addEventListener("click", event => handleMacroLinkClick(event, {
                    type: "item-sheet",
                    itemId: item.id,
                    itemUuid: item.uuid,
                    item,
                }));
            }
        });
    }
};
