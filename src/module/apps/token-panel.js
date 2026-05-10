const ACTION_COST_ICONS = {
    standard: "systems/ptu/static/images/icons/StandardAction.svg",
    rapid:    "systems/ptu/static/images/icons/RapidAction.svg",
    shift:    "systems/ptu/static/images/icons/ShiftAction.svg",
    free:     "systems/ptu/static/images/icons/FreeAction.svg",
};

function buildActionCostIcons(actionCost) {
    if (!actionCost) return [];
    return Object.entries(ACTION_COST_ICONS)
        .filter(([key]) => actionCost[key])
        .map(([key, src]) => ({ src, label: key.charAt(0).toUpperCase() + key.slice(1) + " Action" }));
}

export class TokenPanel extends Application {
    get token() {
        return canvas.tokens.controlled.at(0)?.document ?? null;
    }

    get actor() {
        return this.token?.actor ?? game.user?.character ?? null;
    }

    get shouldShow() {
        return !!this.actor && game.user.settings.showTokenPanel;
    }

    /**
     * Debounce and slightly delayed request to re-render this panel. Necessary for situations where it is not possible
     * to properly wait for promises to resolve before refreshing the UI.
     */
    refresh = foundry.utils.debounce(this.render, 100);

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "ptu-token-panel",
            template: "systems/ptu/static/templates/apps/token-panel.hbs",
            popOut: false,
        });
    }

    async _getItemData(item) {
        const effectText = item.system.snippet || item.system.effect || "";
        const freq = item.system.frequency?.type ? CONFIG.PTU.data.frequencies[item.system.frequency.type] : null;
        const usageDisplay = (() => {
            if (!freq) return null;
            const ud = {};
            if (freq.limited) {
                ud.limited = true;
                ud.remaining = Math.max(0, (item.system.frequency?.max ?? 1) - (item.flags?.ptu?.used ?? 0));
                ud.max = item.system.frequency?.max ?? 1;
            }
            if (freq.eot && item.flags?.ptu?.eot > 0) {
                ud.eot = true;
            }
            return Object.keys(ud).length > 0 ? ud : null;
        })();
        return {
            name: item.name,
            img: item.img,
            id: item.id,
            effect: effectText ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(foundry.utils.duplicate(effectText), {async: true}) : "",
            frequency: item.system.frequency ?? null,
            actionCost: item.system.actionCost ?? null,
            ap: item.system.ap ?? null,
            rollable: !!item.roll,
            onCooldown: item.onCooldown ?? false,
            usageDisplay,
            actionCostIcons: buildActionCostIcons(item.system.actionCost ?? null),
        }
    }

    /** @override */
    async getData(options = {}) {
        const { actor } = this;
        if (!actor || !game.user.settings.showTokenPanel) return {
            user: { isGM: false },
            actor: null,
        };

        const showEffectiveness = game.settings.get("ptu", "metagame.showTypeEffectiveness");
        const targetActors = showEffectiveness
            ? [...game.user.targets].map(t => t.actor).filter(Boolean)
            : [];

        const getEffectivenessData = (type) => {
            if (!targetActors.length || !type) return null;
            const getTier = (val) => {
                if (val === 0) return { key: "immune", label: "Immune (0x)" };
                if (val < 1) return { key: "resist", label: "Not Very Effective (<1x)" };
                if (val === 1) return { key: "normal", label: "Normal (1x)" };
                if (val === 1.5) return { key: "super", label: "Supereffective (1.5x)" };
                return { key: "ultra", label: "Ultraeffective (2x+)" };
            };
            const tiers = targetActors.map(a => getTier(a.iwr?.getRealValue(type) ?? 1));
            if (tiers.some(t => t.key !== tiers[0].key)) return null;
            return tiers[0];
        };

        const attacks = [];
        const struggles = [];
        for (const [id, attack] of actor.attacks.entries()) {
            if (attack.item.getFlag("ptu", "showInTokenPanel") === false) continue;
            const data = {
                name: attack.label,
                img: attack.img,
                db: (() => {
                    const db = attack.item?.damageBase;
                    if (!db) return null;
                    if (!db.isFormula) return db.postStab;
                    const preview = attack.item.dbPreviewNumber;
                    return preview !== null ? `${preview}*` : "?*";
                })(),
                ac: attack.item?.system.ac > 0 ? attack.item.system.ac : null,
                frequency: attack.item?.system.frequency ?? { type: "at-will", max: 0 },
                actionCost: attack.item?.system.actionCost ?? null,
                ap: attack.item?.system.ap ?? null,
                id,
                rollable: !!attack.roll,
                onCooldown: attack.onCooldown ?? false,
                effect: attack.item?.system.effect ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(foundry.utils.duplicate(attack.item.system.effect), {async: true}) : "",
                range: attack.item?.system.range ?? "",
                keywords: attack.item?.system.keywords ?? [],
                hasAllyKeyword: (attack.item?.system.keywords ?? []).some(k => typeof k === "string" && k.toLowerCase() === "ally"),
                sort: attack.item?.sort ?? 0,
                effectiveness: getEffectivenessData(attack.item?.system.type),
                usageDisplay: (() => {
                    const freq = attack.item?.system.frequency?.type ? CONFIG.PTU.data.frequencies[attack.item.system.frequency.type] : null;
                    if (!freq) return null;
                    const ud = {};
                    if (freq.limited) {
                        ud.limited = true;
                        ud.remaining = Math.max(0, (attack.item.system.frequency?.max ?? 1) - (attack.item.flags?.ptu?.used ?? 0));
                        ud.max = attack.item.system.frequency?.max ?? 1;
                    }
                    if (freq.eot && attack.item.flags?.ptu?.eot > 0) {
                        ud.eot = true;
                    }
                    return Object.keys(ud).length > 0 ? ud : null;
                })(),
                typeClass: attack.item?.system.type ? `type-${attack.item.system.type.toLowerCase()}` : "",
            };
            if (attack.item?.system.category) data.category = `/systems/ptu/static/css/images/types2/${attack.item?.system.category}IC_Icon.png`;
            if (attack.item?.system.type) data.type = { icon: `/systems/ptu/static/css/images/types2/${attack.item.system.type}IC_Icon.png`, name: attack.item.system.type };
            data.actionCostIcons = buildActionCostIcons(attack.item?.system.actionCost ?? null);
            if (attack.item.system.isStruggle) struggles.push(data);
            else attacks.push(data);
        }

        const items = actor.itemTypes.item?.sort((a, b) => a.sort - b.sort)?.reduce((acc, item) => {
            if (item.getFlag("ptu", "showInTokenPanel") === false) return acc;
            if (item.getFlag("ptu", "showInTokenPanel") !== false && (item.getFlag("ptu", "showInTokenPanel") !== true && !item.roll)) return acc;
            if (item instanceof CONFIG.PTU.Item.documentClasses.pokeball) acc.balls.push(item);
            else acc.other.push(item);
            return acc;
        }, { balls: [], other: [] });

        const feats = [];
        for (const feat of actor.itemTypes.feat?.sort((a, b) => a.sort - b.sort) ?? []) {
            if (feat.getFlag("ptu", "showInTokenPanel") === false) continue;
            feats.push(await this._getItemData(feat));
        }

        const abilities = [];
        for (const ability of actor.itemTypes.ability?.sort((a, b) => a.sort - b.sort) ?? []) {
            if (ability.getFlag("ptu", "showInTokenPanel") === false) continue;
            abilities.push(await this._getItemData(ability));
        }

        const edges = [];
        for (const edge of actor.itemTypes.edge?.sort((a, b) => a.sort - b.sort) ?? []) {
            if (!(edge.getFlag("ptu", "showInTokenPanel") ?? false)) continue;
            edges.push(await this._getItemData(edge));
        }
        
        for (const pokeedge of actor.itemTypes.pokeedge?.sort((a, b) => a.sort - b.sort) ?? []) {
            if (!(pokeedge.getFlag("ptu", "showInTokenPanel") ?? false)) continue;
            const edgeData = await this._getItemData(pokeedge);
            edgeData.pokeedge = true;
            edges.push(edgeData);
        }

        const capabilities = [];
        for (const capability of actor.itemTypes.capability?.sort((a, b) => a.sort - b.sort) ?? []) {
            if (!(capability.getFlag("ptu", "showInTokenPanel") ?? false)) continue;
            capabilities.push(await this._getItemData(capability));
        }

        const effects = [];
        for (const effect of actor.itemTypes.effect?.sort((a, b) => a.sort - b.sort) ?? []) {
            if (effect.getFlag("ptu", "showInTokenPanel") === false) continue;
            effects.push({
                parent: effect.parent.id,
                ...await this._getItemData(effect),
            });
        }

        let movement = [];
        movement.push(
            {name: "Overland", value: actor.system.capabilities?.overland ?? 0, icon: "fas fa-shoe-prints"},
            {name: "Swim", value: actor.system.capabilities?.swim ?? 0, icon: "fas fa-swimmer"},
            {name: "Burrow", value: actor.system.capabilities?.burrow ?? 0, icon: "fas fa-mountain"},
            {name: "Levitate", value: actor.system.capabilities?.levitate ?? 0, icon: "fas fa-feather"},
            {name: "Sky", value: actor.system.capabilities?.sky ?? 0, icon: "fab fa-fly"},
            {name: "Teleporter", value: actor.system.capabilities?.teleporter ?? 0, icon: "fas fa-people-arrows"},
            {name: "Throwing", value: actor.system.capabilities?.throwingRange ?? 0, icon: "fas fa-baseball-ball"},
        );

        movement = movement.filter(item => item.value !== 0);

        let heldItem = null;
        if(this.actor.system.heldItem && this.actor.system.heldItem != "None") {
            const item = await game.ptu.item.get(this.actor.system.heldItem, "item");
            heldItem = {
                name: item?.name || this.actor.system.heldItem,
                img: item?.img || "icons/svg/item-bag.svg",
            }
        }

        const show = {
            party: true, // Default to expanded
            ...game.user.getFlag("ptu", "TokenPanel.show") ?? {}
        };

        return {
            ...(await super.getData(options)),
            user: { isGM: game.user.isGM },
            actor,
            attacks: attacks.sort((a, b) => a.sort - b.sort),
            struggles,
            items,
            show,
            party: this.#getPartyInfo(),
            conditions: actor.itemTypes.condition || [],
            effects,
            feats,
            edges,
            capabilities,
            abilities,
            heldItem,
            movement,
            minimized: game.user.settings.tokenPanelMinimized ?? false,
        }
    }

    /** @override */
    async _render(force, options) {
        const scrollPositions = new Map();
        if (this.element?.length) {
            for (const el of this.element[0].querySelectorAll("[data-scroll-key]")) {
                scrollPositions.set(el.dataset.scrollKey, el.scrollTop);
            }
        }
        await super._render(force, options);
        if (this.element?.length) {
            for (const el of this.element[0].querySelectorAll("[data-scroll-key]")) {
                const saved = scrollPositions.get(el.dataset.scrollKey);
                if (saved !== undefined) el.scrollTop = saved;
            }
        }
    }

    /** @override */
    activateListeners($html) {
        super.activateListeners($html);
        this._activateContentListeners($html);
    }

    _activateContentListeners($html) {
        for (const toggle of $html.find(".tab-strip-tab, .top-panel-toggle")) {
            toggle.addEventListener("click", (event) => {
                const target = event.currentTarget.dataset.target;
                const isShown = game.user.getFlag("ptu", `TokenPanel.show.${target}`);
                game.user.setFlag("ptu", `TokenPanel.show.${target}`, !isShown);
                this.refresh();
            });
        }

        const minimizeBtn = $html.find(".tab-strip-minimize")[0];
        if (minimizeBtn) {
            minimizeBtn.addEventListener("click", () => {
                const isMinimized = game.user.settings.tokenPanelMinimized ?? false;
                game.user.setFlag("ptu", "settings.tokenPanelMinimized", !isMinimized);
            });
        }

        for (const action of $html.find(".action.attack, .action.struggle")) {
            action.addEventListener("click", (event) => {
                const id = event.currentTarget.dataset.id;
                const attack = this.actor.attacks.get(id);
                if (!attack) return;

                if (attack.roll) attack.roll({
                    event, callback: async (rolls, targets, msg, event) => {
                        await attack?.consume?.();
                        if (!game.settings.get("ptu", "autoRollDamage")) return;

                        const params = {
                            event,
                            options: msg.context.options ?? [],
                            actor: msg.actor,
                            targets: msg.targets,
                            rollResult: msg.context.rollResult ?? null,
                        }
                        const result = await attack.damage?.(params);
                        if (result === null) {
                            return await msg.update({ "flags.ptu.resolved": false })
                        }
                    }
                });
                else {
                    attack?.consume?.();
                    attack.item?.sendToChat?.();
                }
            });
            action.addEventListener("contextmenu", (event) => {
                const id = event.currentTarget.dataset.id;
                const attack = this.actor.attacks.get(id);
                return attack?.item?.sendToChat?.();
            });
            // TODO: hover to highlight valid targets on the canvas
            // This isn't quite working how I wanted, but it's a start
            // leaving this commented here for future use
            // action.addEventListener("mouseover", (event) => {
            //     if (!canvas.ready) return;
            //     const isAlly = event.currentTarget.dataset.ally === "true";
            //     const tokens = canvas.tokens.placeables.filter(t => {
            //         if (!t.isVisible || !t.actor) return false;
            //         return isAlly ? this.actor.isFriendOf(t.actor) : this.actor.isEnemyOf(t.actor);
            //     });
            //     tokens.forEach(t => t._onHoverIn(event));
            //     this.moveHighlights = tokens;
            // });
            // action.addEventListener("mouseout", (event) => {
            //     if (this.moveHighlights?.length > 0) {
            //         this.moveHighlights.forEach(t => t._onHoverOut(event));
            //         this.moveHighlights = [];
            //     }
            // });
        }

        const dexBtn = $html.find(".tab-strip-dex")[0];
        if (dexBtn) {
            dexBtn.addEventListener("click", () => game.ptu.macros.pokedex());
        }

        const undockBtn = $html.find(".tab-strip-undock")[0];
        if (undockBtn) {
            undockBtn.addEventListener("click", () => {
                game.user.setFlag("ptu", "settings.tokenPanelUndocked", true);
            });
        }

        for (const action of $html.find(".action.item.pokeball")) {
            action.addEventListener("click", (event) => {
                const id = event.currentTarget.dataset.id;
                const ball = this.actor.items.get(id);
                if (!ball) return;

                if (ball.roll) ball.roll({event});
                else ball.sendToChat?.();
            });
        }

        for (const action of $html.find(".action.item:not(.pokeball), .action.ability, .action.feat, .action.edge, .action.pokeedge, .action.capability")) {
            action.addEventListener("click", (event) => {
                const id = event.currentTarget.dataset.id;
                const item = this.actor.items.get(id);
                if (!item) return;

                if (item.roll) {
                    item.roll({event}).then(() => item?.consume?.());
                } else {
                    item?.consume?.();
                    item.sendToChat?.();
                }
            });
            action.addEventListener("dblclick", (event) => {
                const id = event.currentTarget.dataset.id;
                const item = this.actor.items.get(id);
                return item?.sheet?.render?.({force: true});
            });
            action.addEventListener("contextmenu", (event) => {
                const id = event.currentTarget.dataset.id;
                const item = this.actor.items.get(id);
                return item?.sendToChat?.();
            });
        };

        for (const actor of $html.find(".trainer, .pokemon")) {
            actor.addEventListener("click", (event) => {
                const target = event.currentTarget;
                clearTimeout(this._clickActorTimeout);
                this._clickActorTimeout = setTimeout(() => {
                    const id = target.dataset.id;
                    const actor = game.actors.get(id);
                    if (!actor) return;

                    const token = actor?.getActiveTokens(true)[0];
                    if (!token) return;

                    token.control({ releaseOthers: true });
                    canvas.animatePan({ x: token.document.x, y: token.document.y });
                }, 200);
            });
            actor.addEventListener("dblclick", (event) => {
                clearTimeout(this._clickActorTimeout);
                const id = event.currentTarget.dataset.id;
                const actor = game.actors.get(id);
                if (!actor) return;

                actor.sheet.render(true);
            });
            actor.addEventListener("mouseover", (event) => {
                event.preventDefault();
                if (!canvas.ready) return;

                const id = event.currentTarget.dataset.id;
                const actor = game.actors.get(id);
                if (!actor) return;

                const tokens = actor?.getActiveTokens(true);
                if (tokens?.length == 0) return;

                if (tokens.every(token => token.isVisible)) {
                    tokens.forEach(token => token._onHoverIn(event));
                    this.highlights = tokens;
                }
            });
            actor.addEventListener("mouseout", (event) => {
                event.preventDefault();
                if (!canvas.ready) return;

                if (this.highlights?.length > 0) {
                    this.highlights.forEach(token => token._onHoverOut(event));
                    this.highlights = [];
                }
            });
            actor.addEventListener("dragstart", (event) => {
                const id = event.currentTarget.dataset.id;
                const actor = game.actors.get(id);
                if (!actor) return;

                event.dataTransfer.setData("text/plain", JSON.stringify({
                    type: "Actor",
                    uuid: actor.uuid,
                }));
            });
        }

        for (const item of $html.find(".condition, .effect")) {
            item.addEventListener("click", (event) => {
                const target = event.currentTarget;
                clearTimeout(this._clickEffectTimeout);
                this._clickEffectTimeout = setTimeout(() => {
                    const id = target.dataset.actorId;
                    const actor = game.actors.get(id);
                    if (!actor) return;

                    const itemId = target.dataset.itemId;
                    const item = actor.items.get(itemId);
                    if (!item) return;

                    item.increase();
                }, 200);
            });
            item.addEventListener("dblclick", (event) => {
                clearTimeout(this._clickEffectTimeout);
                const id = event.currentTarget.dataset.actorId;
                const actor = game.actors.get(id);
                if (!actor) return;

                const itemId = event.currentTarget.dataset.itemId;
                const item = actor.items.get(itemId);
                if (!item) return;

                item.sheet.render(true);
            });
            item.addEventListener("contextmenu", (event) => {
                const id = event.currentTarget.dataset.actorId;
                const actor = game.actors.get(id);
                if (!actor) return;

                const itemId = event.currentTarget.dataset.itemId;
                const item = actor.items.get(itemId);
                if (!item) return;

                if (event.shiftKey) return item.decrease();
                Dialog.confirm({
                    title: `${(item.system.value?.value > 1) ? "Decrease" : "Delete"} ${item.name}?`,
                    content: `<p>Are you sure you want to ${(item.system.value?.value > 1) ? "decrease" : "delete"} ${item.name}?</p>`,
                    yes: () => item.decrease(),
                    no: () => { },
                    defaultYes: false
                })
            });
        }

        $html.find(".action[title], .condition[title], .effect[title]").tooltipster({
            theme: `tooltipster-shadow ball-themes ${this.actor?.sheet?.ballStyle}`,
			position: 'top',
            maxWidth: 500,
            contentAsHTML: true,
            interactive: true,
		});
    }

    #getPartyInfo() {
        const party = {
            trainer: null,
            pokemon: [],
            isTrainer: false,
        };
        if (this.actor.type == "pokemon") {
            (() => {
                // if a trainer is set, get the actor
                if (this.actor.flags?.ptu?.party?.trainer) {
                    party.trainer = game.actors.get(this.actor.flags.ptu.party.trainer);

                    return;
                }

                // Otherwise, try find the trainer from the user
                if (game.user.character && game.user.character.type == "trainer") {
                    this.trainer = game.user.character;
                    return;
                }

                // Otherwise, attempt to find the trainer from ownership permissions
                const pool = [];
                for (const [owner, value] of Object.entries(this.actor.ownership)) {
                    if (owner == "default" || value < 3) continue;

                    const user = game.users.get(owner);
                    if (!user) continue;

                    if (user.character && user.character.type == "character") {
                        pool.push(user.character);
                    }
                }
                if (pool.length == 1) {
                    this.trainer = pool[0];
                    return;
                }
            })()
        }
        else {
            party.trainer = this.actor;
            party.isTrainer = true;
        }

        if (!party.trainer) return party;

        const folder = party.trainer.folder;
        if (!folder) return party;

        const partyFolder = folder.children.find(folder => folder.folder.name == "Party")?.folder;
        if (!partyFolder) return party;

        const pokemon = partyFolder.contents.filter(actor => actor.type == "pokemon" &&
            actor.flags?.ptu?.party?.trainer == party.trainer.id &&
            !actor.flags?.ptu?.party?.boxed);

        if (pokemon.length > 0) party.pokemon = pokemon;
        return party;
    }

    /** @override */
    async render() {
        const undocked = game.user.getFlag("ptu", "settings.tokenPanelUndocked") ?? false;
        if (undocked && this.shouldShow) {
            // Remove the docked element from the DOM if it is currently rendered
            if (this.rendered) await super.close({ force: true });
            document.querySelector("body").classList.remove("token-panel-open");
            document.querySelector("body").classList.remove("token-panel-minimized");
            // Create window lazily once; keep the instance alive so its position survives close/re-open cycles
            if (!this._window) this._window = new TokenPanelWindow();
            return this._window.render(true);
        }
        // Docked mode: close floating window if rendered, but keep the instance for position memory
        if (this._window?.rendered) this._window.close({ force: true });
        if (!this.shouldShow) {
            document.querySelector("body").classList.remove("token-panel-open");
            document.querySelector("body").classList.remove("token-panel-minimized");
        } else {
            document.querySelector("body").classList.add("token-panel-open");
            if (game.user.settings.tokenPanelMinimized) {
                document.querySelector("body").classList.add("token-panel-minimized");
            } else {
                document.querySelector("body").classList.remove("token-panel-minimized");
            }
        }
        return super.render(...arguments);
    }
}

class TokenPanelWindow extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "ptu-token-panel-window",
            title: "Token Panel",
            template: "systems/ptu/static/templates/apps/token-panel-window.hbs",
            popOut: true,
            resizable: true,
            width: 560,
            height: 520,
            classes: ["ptu", "token-panel-window"],
        });
    }

    async getData(options = {}) {
        return game.ptu.tokenPanel.getData(options);
    }

    activateListeners($html) {
        super.activateListeners($html);
        game.ptu.tokenPanel._activateContentListeners($html);
        const dockBtn = $html.find(".tab-strip-dock")[0];
        if (dockBtn) {
            dockBtn.addEventListener("click", async () => {
                await game.user.setFlag("ptu", "settings.tokenPanelUndocked", false);
                game.ptu.tokenPanel.render(true);
            });
        }
    }

    async close(options = {}) {
        await super.close(options);
        // When user closes the window manually (not a forced close from docking), revert to docked
        if (!options.force) {
            await game.user.setFlag("ptu", "settings.tokenPanelUndocked", false);
            game.ptu.tokenPanel.render(true);
        }
    }
}