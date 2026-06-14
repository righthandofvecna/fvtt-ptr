class CombatXPDialog extends FormApplication {
    constructor(combat, options = {}) {
        super(options);
        this.combat = combat;
        /** @type {Array<{uuid: string, name: string, img: string, cost: number, quantity: number}>|null} */
        this.rewardItems = null;
        /** @type {Record<string, number>|null} */
        this.moneyRewards = null;
        /** @type {boolean|null} */
        this.isTrainerBattle = null;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: game.i18n.localize("PTU.CombatXP.Title"),
            classes: ["ptu", "sheet", "combat-xp"],
            template: "systems/ptu/static/templates/apps/combat-xp-dialog.hbs",
            width: 600,
            height: "auto",
            submitOnChange: false,
            submitOnClose: false,
            closeOnSubmit: true,
            resizable: false,
            dragDrop: [{ dropSelector: ".reward-drop-zone" }],
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

        // significance factor
        const apl = [...trainerMap.values()].reduce((sum, { trainer }) => sum + (trainer.apl || 0), 0) / trainerMap.size || 1;
        const significance = budget / (apl * trainerCount);
        const sigMult = 1 + (0.2 * significance);
        const rewardTotal = Math.ceil(budget * trainerCount * sigMult / 100) * 100; // round up to nearest 100
        const isTrainerBattle = game.settings.get("ptu", "leagueBattle") || this.combat.hasEnemyTrainers;

        this.isTrainerBattle = isTrainerBattle;

        // Initialize money rewards once (per trainer, split evenly)
        if (this.moneyRewards === null) {
            const perTrainerMoney = Math.floor(rewardTotal / trainerCount);
            this.moneyRewards = {};
            for (const { trainer } of trainerMap.values()) {
                this.moneyRewards[trainer.id] = perTrainerMoney;
            }
        }

        // Initialize item rewards once
        if (this.rewardItems === null) {
            if (!isTrainerBattle) {
                await this._buildRewardItems(rewardTotal);
            } else {
                this.rewardItems = [];
            }
        }

        return {
            budget,
            trainerCount,
            perPlayerXP,
            perPokemonXP,
            trainers: trainerRows,
            useTrainerPool,
            isTrainerBattle,
            rewardTotal,
            rewardItems: this.rewardItems,
            moneyRewards: this.moneyRewards,
        };
    }

    /**
     * Build a seeded-stable list of Wild Drop items whose total cost is roughly equal to the target.
     * @param {number} target
     */
    async _buildRewardItems(target) {
        const browser = game.ptu?.compendiumBrowser;
        if (!browser) {
            this.rewardItems = [];
            return;
        }

        const enabledPacks = Object.entries(browser.settings?.items ?? {})
            .flatMap(([collection, data]) => data?.load ? [collection] : []);

        if (enabledPacks.length === 0) {
            this.rewardItems = [];
            return;
        }

        const pool = [];
        const indexFields = ["img", "system.keywords", "system.cost"];

        for await (const { pack, index } of browser.packLoader.loadPacks("Item", enabledPacks, indexFields)) {
            for (const itemData of index) {
                if (itemData.type !== "item") continue;
                const cost = Number(itemData.system?.cost);
                if (!cost || cost <= 0) continue;
                const keywords = itemData.system?.keywords ?? [];
                if (!keywords.some(k => k === "Wild Drop")) continue;
                pool.push({
                    uuid: `Compendium.${pack.collection}.${itemData._id}`,
                    name: itemData.name,
                    img: itemData.img,
                    cost,
                });
            }
        }

        if (pool.length === 0) {
            this.rewardItems = [];
            return;
        }

        // Seeded shuffle using combat id
        const seed = this._hashStr(this.combat.id);
        const rng = this._mulberry32(seed);
        const shuffled = pool.map(item => ({ item, sort: rng() })).sort((a, b) => a.sort - b.sort).map(e => e.item);

        // Greedy fill: pick items until value >= target
        const picked = new Map(); // uuid → { item, quantity }
        let total = 0;
        const FUDGE_FACTOR = 1.1; // allow going up to 10% over target to avoid leaving small unfillable gaps

        for (const item of shuffled) {
            if (total >= target) break;
            if (item.cost > (target * FUDGE_FACTOR) - total) continue; // skip items that exceed remaining budget
            const remaining = target - total;
            const qty = Math.max(1, Math.floor(remaining / item.cost));
            const entry = picked.get(item.uuid);
            if (entry) {
                entry.quantity += qty;
            } else {
                picked.set(item.uuid, { ...item, quantity: qty });
            }
            total += item.cost * qty;
        }

        this.rewardItems = [...picked.values()];
    }

    /**
     * Simple djb2 string hash.
     * @param {string} str
     * @returns {number}
     */
    _hashStr(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash |= 0; // convert to 32-bit int
        }
        return hash >>> 0;
    }

    /**
     * Mulberry32 PRNG — returns a function that produces floats in [0, 1).
     * @param {number} seed
     * @returns {() => number}
     */
    _mulberry32(seed) {
        let s = seed;
        return function () {
            s |= 0; s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    /**
     * Sync qty inputs from the live DOM back into this.rewardItems before mutating the list.
     * @param {JQuery} html
     */
    _syncRewardQtys(html) {
        if (!this.rewardItems) return;
        for (let i = 0; i < this.rewardItems.length; i++) {
            const val = parseInt(html.find(`input[name="reward-qty-${i}"]`).val());
            if (!isNaN(val) && val > 0) this.rewardItems[i].quantity = val;
        }
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        html.on("click", "[data-action='remove-reward-item']", (event) => {
            event.preventDefault();
            const index = parseInt(event.currentTarget.dataset.index);
            if (isNaN(index)) return;
            this._syncRewardQtys(html);
            this.rewardItems.splice(index, 1);
            this.render(true);
        });
    }

    /** @override */
    async _onDrop(event) {
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData("text/plain"));
        } catch (e) {
            return;
        }
        if (data.type !== "Item" || !data.uuid) return;

        const item = await fromUuid(data.uuid);
        if (!item || item.type !== "item") return;

        const html = $(this.element);
        this._syncRewardQtys(html);

        const existing = this.rewardItems.find(r => r.uuid === item.uuid);
        if (existing) {
            existing.quantity += 1;
        } else {
            this.rewardItems.push({
                uuid: item.uuid,
                name: item.name,
                img: item.img,
                cost: Number(item.system?.cost) || 0,
                quantity: 1,
            });
        }

        this.render(true);
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

        // Award money to trainers (trainer battles)
        if (this.isTrainerBattle) {
            const moneyTrainerIds = Object.keys(this.moneyRewards ?? {});
            for (const trainerId of moneyTrainerIds) {
                if (formData[`exclude-money-${trainerId}`]) continue;

                const moneyAmount = parseInt(formData[`money-${trainerId}`]) || 0;
                if (moneyAmount <= 0) continue;

                const trainer = game.actors.get(trainerId);
                if (!trainer) continue;

                const currentMoney = trainer.system.money ?? 0;
                await trainer.update({ "system.money": currentMoney + moneyAmount });
            }
        }

        // Collect awarded items from form
        const awardedItems = [];
        if (this.rewardItems) {
            for (let i = 0; i < this.rewardItems.length; i++) {
                const uuid = formData[`reward-uuid-${i}`];
                const qty = parseInt(formData[`reward-qty-${i}`]) || 0;
                const name = this.rewardItems[i]?.name;
                const img = this.rewardItems[i]?.img;
                if (!uuid || qty <= 0 || !name) continue;
                awardedItems.push({ uuid, name, img, quantity: qty });
            }
        }

        // Post chat message with awarded items
        if (awardedItems.length > 0) {
            const rows = awardedItems.map(item =>
                `<li style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                    <img src="${item.img}" width="24" height="24" style="border-radius:3px;"/>
                    <span>${item.name}</span>
                    <span style="margin-left:auto;">×${item.quantity}</span>
                </li>`
            ).join("");
            await ChatMessage.create({
                content: `<div>
                    <strong>Available Loot</strong>
                    <ul style="list-style:none;padding:0;margin:4px 0 0 0;">${rows}</ul>
                </div>`,
            });
        }
    }
}

export { CombatXPDialog };
