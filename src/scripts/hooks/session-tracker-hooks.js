import { PTUSessionTracker } from "../../module/apps/session-tracker/tracker.js";
import { PTUSessionEndApp } from "../../module/apps/session-tracker/sheet.js";

export const SessionTrackerHooks = {
    listen() {
        // ── Record Pokémon added to the active scene ──────────────────────────
        Hooks.on("createToken", (tokenDoc) => {
            if (!game.user.isGM) return;
            const actor = tokenDoc.actor;
            PTUSessionTracker.record(actor);
        });

        // ── Record Pokémon added to initiative ────────────────────────────────
        Hooks.on("createCombatant", (combatant) => {
            if (!game.user.isGM) return;
            const actor = combatant.actor;
            PTUSessionTracker.record(actor);
        });

        // ── Record Pokémon that generate a chat message (rolls, moves, etc.) ──
        Hooks.on("createChatMessage", (message) => {
            if (!game.user.isGM) return;
            const actorId = message.speaker?.actor;
            if (!actorId) return;
            const actor = game.actors.get(actorId);
            PTUSessionTracker.record(actor);
        });

        // ── Open session-end app when the hook fires ──────────────────────────
        Hooks.on("ptu.sessionEnd", () => {
            if (!game.user.isGM) return;
            let app = Object.values(ui.windows).find(
                w => w instanceof PTUSessionEndApp
            );
            if (!app) app = new PTUSessionEndApp();
            app.render({ force: true });
        });
    },
};
