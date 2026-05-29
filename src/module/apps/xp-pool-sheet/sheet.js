class PTUXpPoolSheet extends FormApplication {
    constructor({ actor, ...options } = {}) {
        if (!actor) throw new Error("PTUXpPoolSheet requires an actor");
        super(options);
        this.trainer = actor.type === "pokemon" ? (actor.trainer ?? null) : actor;
        if (!this.trainer) throw new Error("PTUXpPoolSheet: could not resolve trainer");
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "PTU.XPPoolSheet.Title",
            classes: ["ptu", "sheet", "party", "xp-pool"],
            width: 580,
            height: 600,
            template: "systems/ptu/static/templates/apps/xp-pool-sheet.hbs",
            resizable: true,
            submitOnChange: false,
            submitOnClose: false,
            closeOnSubmit: false,
        });
    }

    /** @override */
    get title() {
        return game.i18n.format("PTU.XPPoolSheet.Title");
    }

    /** @override */
    async getData() {
        const trainer = this.trainer;
        const pool = trainer.system.level.xpPool ?? 0;
        const levelProgression = CONFIG.PTU.data.levelProgression;
        const maxLevel = Math.max(...Object.keys(levelProgression).map(Number));

        const buildRows = (actors) => actors.map(pokemon => {
            const exp = pokemon.system.level.exp ?? 0;
            const pendingExp = pokemon.system.level.pendingExp ?? 0;
            const totalEffective = exp + pendingExp;
            const effectiveLevel = calculateLevel(totalEffective);
            const isMaxLevel = effectiveLevel >= maxLevel;

            const xpForNextLevel = isMaxLevel
                ? null
                : Math.max(0, levelProgression[effectiveLevel + 1] - totalEffective);

            const currentLevelFloor = levelProgression[effectiveLevel] ?? 0;
            const nextLevelXp = isMaxLevel ? totalEffective : levelProgression[effectiveLevel + 1];
            const progressInLevel = totalEffective - currentLevelFloor;
            const levelSize = nextLevelXp - currentLevelFloor;
            const progressPercent = isMaxLevel ? 100 : Math.round((progressInLevel / levelSize) * 100);

            return {
                actorId: pokemon.id,
                actorUuid: pokemon.uuid,
                name: pokemon.name,
                img: pokemon.img,
                currentLevel: pokemon.system.level.current,
                effectiveLevel,
                pendingExp,
                xpForNextLevel,
                isMaxLevel,
                canLevelUp: !isMaxLevel && pool >= xpForNextLevel,
                progressPercent: Math.min(Math.max(progressPercent, 0), 100),
                hasPending: pendingExp > 0,
            };
        });

        // Load party pokemon (active team, not boxed)
        const party = game.actors.filter(a =>
            a.type === "pokemon" &&
            a.flags?.ptu?.party?.trainer === trainer.id &&
            !a.flags?.ptu?.party?.boxed
        );

        // Load boxed pokemon
        const boxed = game.actors.filter(a =>
            a.type === "pokemon" &&
            a.flags?.ptu?.party?.trainer === trainer.id &&
            a.flags?.ptu?.party?.boxed
        );

        return {
            trainer,
            pool,
            party: buildRows(party),
            boxed: buildRows(boxed),
        };
    }

    /** @override */
    _updateObject() {
        // All actions are handled via button clicks; nothing to submit.
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        html.find(".xp-level-up").click(async (event) => {
            event.preventDefault();
            const actorId = event.currentTarget.dataset.actorId;
            const cost = parseInt(event.currentTarget.dataset.cost);
            if (!actorId || isNaN(cost) || cost <= 0) return;

            const pokemon = game.actors.get(actorId);
            if (!pokemon) return;

            const currentPool = this.trainer.system.level.xpPool ?? 0;
            if (currentPool < cost) {
                return ui.notifications.warn(game.i18n.localize("PTU.XPPoolSheet.InsufficientPool"));
            }

            await Promise.all([
                this.trainer.update({ "system.level.xpPool": currentPool - cost }),
                pokemon.update({ "system.level.pendingExp": (pokemon.system.level.pendingExp ?? 0) + cost }),
            ]);

            this.render(false);
        });

        html.find(".xp-pool-actor-open").click(async (event) => {
            event.preventDefault();
            const uuid = event.currentTarget.dataset.actorUuid;
            const actor = await fromUuid(uuid);
            actor?.sheet?.render(true);
        });
    }
}

export { PTUXpPoolSheet };
