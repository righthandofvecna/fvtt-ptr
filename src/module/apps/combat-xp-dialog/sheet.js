class CombatXPDialog extends FormApplication {
    constructor(combat, options = {}) {
        super(options);
        this.combat = combat;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: game.i18n.localize("PTU.CombatXP.Title"),
            classes: ["ptu", "sheet", "combat-xp"],
            template: "systems/ptu/static/templates/apps/combat-xp-dialog.hbs",
            width: 520,
            height: "auto",
            submitOnChange: false,
            submitOnClose: false,
            closeOnSubmit: true,
            resizable: false,
        });
    }

    /** @override */
    async getData() {
        const budget = this.combat.expBudget;

        // Collect player-owned pokemon combatants (deduplicated by actorId)
        const seen = new Set();
        const pokemonRows = [];
        for (const combatant of this.combat.combatants) {
            const actor = combatant.actor;
            if (!actor) continue;
            if (actor.type !== "pokemon") continue;
            if (!actor.hasPlayerOwner) continue;
            if (seen.has(actor.id)) continue;
            seen.add(actor.id);
            pokemonRows.push({
                actorId: actor.id,
                name: actor.name,
                img: actor.img,
            });
        }

        const defaultXP = pokemonRows.length > 0 ? Math.floor(budget / pokemonRows.length) : 0;

        return {
            budget,
            defaultXP,
            pokemon: pokemonRows,
            useTrainerPool: game.settings.get("ptu", "automation.xpToTrainerPool"),
        };
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        html.find(".combat-xp-set-all").click((event) => {
            event.preventDefault();
            const amount = parseInt(html.find(".combat-xp-bulk-amount").val()) || 0;
            html.find(".combat-xp-amount").each((_i, el) => {
                $(el).val(amount);
            });
        });
    }

    /** @override */
    async _updateObject(_event, formData) {
        const useTrainerPool = game.settings.get("ptu", "automation.xpToTrainerPool");

        // formData keys: xp-<actorId>, exclude-<actorId>
        const actorIds = Object.keys(formData)
            .filter(k => k.startsWith("xp-"))
            .map(k => k.slice(3));

        const trainerUpdates = new Map(); // trainerId → array of xp chunks to push

        for (const actorId of actorIds) {
            const excluded = !!formData[`exclude-${actorId}`];
            if (excluded) continue;

            const xpAmount = parseInt(formData[`xp-${actorId}`]) || 0;
            if (xpAmount <= 0) continue;

            const actor = game.actors.get(actorId);
            if (!actor) continue;

            if (useTrainerPool) {
                const trainer = actor.trainer;
                if (trainer) {
                    if (!trainerUpdates.has(trainer.id)) {
                        trainerUpdates.set(trainer.id, [...(trainer.system.level.xpPool ?? [])]);
                    }
                    trainerUpdates.get(trainer.id).push(xpAmount);
                    continue;
                }
                // No trainer → fall back to pendingExp on the pokemon
            }

            // Direct pending XP on pokemon
            const currentPending = actor.system.level.pendingExp ?? 0;
            await actor.update({ "system.level.pendingExp": currentPending + xpAmount });
        }

        // Apply batched trainer pool updates
        for (const [trainerId, pool] of trainerUpdates) {
            const trainer = game.actors.get(trainerId);
            if (trainer) {
                await trainer.update({ "system.level.xpPool": pool });
            }
        }
    }
}

export { CombatXPDialog };
