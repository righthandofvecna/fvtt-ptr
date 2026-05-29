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
            width: 560,
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
        const useTrainerPool = game.settings.get("ptu", "automation.xpToTrainerPool");

        // Collect distinct trainers whose pokemon participated
        const trainerMap = new Map(); // trainerId → { trainer, participatedIds: Set }

        for (const combatant of this.combat.combatants) {
            const actor = combatant.actor;
            if (!actor || actor.type !== "pokemon" || !actor.hasPlayerOwner) continue;

            const trainer = actor.trainer;
            if (!trainer) continue;

            if (!trainerMap.has(trainer.id)) {
                trainerMap.set(trainer.id, { trainer, participatedIds: new Set() });
            }
            trainerMap.get(trainer.id).participatedIds.add(actor.id);
        }

        const trainerCount = Math.max(trainerMap.size, 1);
        const perPlayerXP = Math.floor(budget / trainerCount);
        const perPokemonXP = Math.floor(perPlayerXP / 2);

        // Build trainer rows: each trainer's full active party
        const trainerRows = [];
        for (const { trainer, participatedIds } of trainerMap.values()) {
            const partyPokemon = game.actors.filter(a =>
                a.type === "pokemon" &&
                a.flags?.ptu?.party?.trainer === trainer.id &&
                !a.flags?.ptu?.party?.boxed
            );

            trainerRows.push({
                trainerId: trainer.id,
                trainerName: trainer.name,
                trainerImg: trainer.img,
                poolGrant: perPlayerXP,
                pokemon: partyPokemon.map(p => ({
                    actorId: p.id,
                    name: p.name,
                    img: p.img,
                    xpGrant: perPokemonXP,
                    participated: participatedIds.has(p.id),
                })),
            });
        }

        return {
            budget,
            trainerCount,
            perPlayerXP,
            perPokemonXP,
            trainers: trainerRows,
            useTrainerPool,
        };
    }

    /** @override */
    async _updateObject(_event, formData) {
        const useTrainerPool = game.settings.get("ptu", "automation.xpToTrainerPool");

        const trainerIds = [...new Set(
            Object.keys(formData)
                .filter(k => k.startsWith("pool-"))
                .map(k => k.slice(5))
        )];

        const pokemonActorIds = [...new Set(
            Object.keys(formData)
                .filter(k => k.startsWith("xp-"))
                .map(k => k.slice(3))
        )];

        // Award pending XP to each non-excluded pokemon
        for (const actorId of pokemonActorIds) {
            if (formData[`exclude-${actorId}`]) continue;

            const xpAmount = parseInt(formData[`xp-${actorId}`]) || 0;
            if (xpAmount <= 0) continue;

            const actor = game.actors.get(actorId);
            if (!actor) continue;

            const currentPending = actor.system.level.pendingExp ?? 0;
            await actor.update({ "system.level.pendingExp": currentPending + xpAmount });
        }

        // Award XP pool to each trainer
        if (useTrainerPool) {
            for (const trainerId of trainerIds) {
                if (formData[`exclude-trainer-${trainerId}`]) continue;

                const poolAmount = parseInt(formData[`pool-${trainerId}`]) || 0;
                if (poolAmount <= 0) continue;

                const trainer = game.actors.get(trainerId);
                if (!trainer) continue;

                const currentPool = trainer.system.level.xpPool ?? 0;
                await trainer.update({ "system.level.xpPool": currentPool + poolAmount });
            }
        }
    }
}

export { CombatXPDialog };
