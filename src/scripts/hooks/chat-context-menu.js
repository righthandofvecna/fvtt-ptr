import { RollInspectorDialog } from "../../module/apps/roll-inspector.js";

export const ChatContextMenu = {
    listen() {
        Hooks.on("getChatMessageContextOptions", (_html, options) => {
            options.push({
                name: "Inspect Roll Data",
                icon: '<i class="fas fa-search"></i>',
                condition: (li) => {
                    if (!game.settings.get("ptu", "devMode")) return false;
                    const messageId = li.dataset?.messageId ?? li.closest("[data-message-id]")?.dataset?.messageId;
                    const message = game.messages.get(messageId);
                    console.log("PTU | Checking chat context menu condition for message", { message });
                    return !!(message?.flags?.ptu?.context?.options);
                },
                callback: (li) => {
                    const messageId = li.dataset?.messageId ?? li.closest("[data-message-id]")?.dataset?.messageId;
                    const message = game.messages.get(messageId);
                    if (!message) return;
                    new RollInspectorDialog(message).render(true);
                },
            });
        });
    },
};
