import { PTUItemSheet } from "../index.js";

class PTUSpeciesSheet extends PTUItemSheet {
    /** @override */
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.classes.push("species");
        options.height = 600;
        options.dragDrop = [
            {dragSelector: ".item-list .item.ability-item.draggable", dropSelector: ".item-list .item.ability-item"},
            {dragSelector: ".item-list .item.move-item.draggable", dropSelector: ".item-list .item.move-item"},
            {dragSelector: undefined, dropSelector: '.evolution-item'},
            {dragSelector: undefined, dropSelector: undefined}
        ]
        return options;
    }

    get isEditable() {
        if(!game.settings.get("ptu", "metagame.allowPlayersToEditSpecies")) {
            return game.user.isGM ? super.isEditable : false;
        }
        return super.isEditable;
    }

    /** @override */
    async getData() {
        const data = await super.getData();
        
        data.types = [...Object.keys(CONFIG.PTU.data.typeEffectiveness).filter(type => type != "Untyped")];
        data.types.unshift("");
        if(!game.settings.get("ptu", "homebrew.nuclearType")) data.types = data.types.filter(type => type != "Nuclear");
        if(!game.settings.get("ptu", "homebrew.shadowType")) data.types = data.types.filter(type => type != "Shadow");


        data.view = (() => {
            // "full" : "entry";
            if(game.user.isGM) return "full";

            const permission = game.settings.get("ptu", "metagame.dexPermissions");
            switch(permission) {
                case 1: throw new Error("Players may not open species sheets");
                case 2: return "entry";
                case 3: return this.item.actor?.isOwner ? "full" : "entry";
                case 4: {
                    if(!game.user.character) ui.notifications.warn("PTU.UserNeedsToOwnCharacter", {localize: true})
                    if(!game.user.character?.system.dex?.owned?.length) return "entry";
                    if(game.user.character.system.dex.owned.find(slug => slug == this.item.slug)) return "full";
                    return "entry";
                }
                case 5: {
                    ui.notifications.warn("GM Prompt is not implemented, showing basic view.");
                    return "entry";
                }
                case 6: return "full";
            }
            return "entry";
        })();

        return data;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        html.find('.item[data-uuid] .item-name').on('click', async (event) => {
            event.preventDefault();
            const uuid = event.currentTarget.closest('[data-uuid]')?.dataset.uuid;
            if(!uuid) return;
            const item = await fromUuid(uuid);
            if(item) item.sheet.render(true);
        });

        html.find('.capability-item .item-control.item-delete').on('click', (event) => {
            event.preventDefault();

            const uuid = event.currentTarget.parentElement.parentElement.dataset.uuid;
            if(!uuid) return;

            const items = this.item.system.capabilities.other?.filter(item => item.uuid != uuid) ?? [];
            return this.item.update({"system.capabilities.other": items});
        });

        html.find('.ability-item .item-control.item-delete').on('click', (event) => {
            event.preventDefault();

            const {uuid, itemSubtype} = event.currentTarget.parentElement.parentElement.dataset;
            if(!uuid || !itemSubtype) return;

            const abilities = this.item.system.abilities;
            abilities[itemSubtype] = abilities[itemSubtype]?.filter(item => item.uuid != uuid) ?? [];
            return this.item.update({"system.abilities": abilities});
        });

        html.find('.move-item .item-control.item-delete').on('click', (event) => {
            event.preventDefault();

            const {uuid, itemSubtype} = event.currentTarget.parentElement.parentElement.dataset;
            if(!uuid || !itemSubtype) return;

            const moves = this.item.system.moves;
            moves[itemSubtype] = moves[itemSubtype]?.filter(item => item.uuid != uuid) ?? [];
            return this.item.update({"system.moves": moves});
        });

        html.find('.evolution-item .item-control.item-delete').on('click', (event) => {
            event.preventDefault();

            const {uuid} = event.currentTarget.parentElement.parentElement.dataset;
            if(!uuid) return;

            const evolutions = this.item.system.evolutions;
            evolutions.splice(evolutions.findIndex(e => e.uuid == uuid), 1);
            return this.item.update({"system.evolutions": evolutions});
        });

        html.find('.evolution-item .item-control.sub-item-delete').on('click', (event) => {
            event.preventDefault();

            const {uuid, itemIndex} = event.currentTarget.parentElement.parentElement.dataset;
            if(!uuid || !itemIndex) return;

            const evolutions = this.item.system.evolutions;
            if(!evolutions[itemIndex].other?.evolutionItem) return;

            evolutions[itemIndex].other.evolutionItem = undefined;
            return this.item.update({"system.evolutions": evolutions});
        });

        html.find('.item-list').on('dragover', (event) => {
            event.preventDefault();
            event.currentTarget.classList.add("dragover");
        });

        html.find('.item-list').on('dragleave', (event) => {
            event.preventDefault();
            event.currentTarget.classList.remove("dragover");
        });

        // Also highlight the full drop-zone section (including header) on dragover so the
        // visual feedback matches the actual droppable area.
        html.find('.drop-zone').on('dragover', (event) => {
            event.preventDefault();
            event.currentTarget.classList.add("dragover");
        });

        html.find('.drop-zone').on('dragleave', (event) => {
            // Only remove the highlight when the cursor leaves the whole section,
            // not just when it moves into a child element.
            if (!event.currentTarget.contains(event.relatedTarget)) {
                event.currentTarget.classList.remove("dragover");
            }
        });

        $(html).find('.linked-item').each(async (i, element) => {
			await CONFIG.PTU.util.Enricher.enrichContentLinks(element);
		});
    }

    get allowedDropTypes() {
        return ["capability", "ability", "move", "item", "species"]
    }

    /** @override */
    _onDragStart(event) {
        const li = event.currentTarget;
        const { uuid, type, itemSlug, itemSubtype, itemIndex, itemLevel } = li.dataset;

        // type: "Item" + uuid makes this recognizable as a standard Foundry item drop on any
        // other sheet. _category carries the species-sheet-specific routing info so that
        // _onDrop on this sheet can distinguish intra-sheet reorders from external drops.
        // _sourceItemId ensures cross-species-sheet drags are treated as external, not reorders.
        event.dataTransfer.setData('text/plain', JSON.stringify({
            type: "Item",
            uuid,
            _category: type,
            _sourceItemId: this.item.id,
            slug: itemSlug,
            subtype: itemSubtype,
            index: Number(itemIndex),
            level: itemLevel,
        }));
    }

    /** @override */
    async _onDrop(event) {
        // Prevent double-fire: when a drop lands on a child element (e.g. li.move-item), the drop
        // event bubbles up through all ancestor drop targets (the specific item AND the form).
        // Only the first (most-specific, deepest) handler should process the drop.
        if (event._ptuHandled) return;
        event._ptuHandled = true;

        const data = JSON.parse(event.dataTransfer.getData('text/plain'));

        // Clean up all dragover highlights
        $(this.element).find('.item-list, .drop-zone').removeClass("dragover");

        // Traverse from event.target upward to find the actual drop context, so that drops
        // anywhere within a section (header, empty space, specific item) route correctly.
        const dropItemEl = event.target.closest('[data-item-subtype]');
        const dropZoneEl = event.target.closest('[data-zone]');
        const targetSubtype = dropItemEl?.dataset.itemSubtype ?? dropZoneEl?.dataset.subZone;
        const targetZone = dropItemEl?.dataset.type ?? dropItemEl?.dataset.itemType ?? dropZoneEl?.dataset.zone;
        const targetIndex = (dropItemEl?.dataset.itemIndex !== undefined && dropItemEl?.dataset.itemIndex !== "")
            ? Number(dropItemEl.dataset.itemIndex) : undefined;

        // Intra-sheet reorder/move: data originated from _onDragStart on THIS exact sheet.
        // _sourceItemId distinguishes drags from this sheet vs. another species sheet.
        if (data._category && data._sourceItemId === this.item.id) {
            const { _category: category, subtype, index } = data;
            let itemSubtype = targetSubtype;

            if (category == "ability") {
                // Must be dropped within the ability zone or on a known ability subtype
                if (targetZone != "ability" && !["basic", "advanced", "high"].includes(targetSubtype)) return;
                if (!itemSubtype) return;

                // re-order within same subtype
                if (itemSubtype == subtype) {
                    const abilities = this.item.system.abilities;
                    const ability = abilities[subtype][index];
                    if (!ability) return;
                    abilities[subtype].splice(index, 1);
                    abilities[subtype].splice(targetIndex ?? abilities[subtype].length, 0, ability);
                    return this.item.update({"system.abilities": abilities});
                }
                // move to different subtype
                else {
                    const abilities = this.item.system.abilities;
                    const ability = abilities[subtype][index];
                    if (!ability || abilities[itemSubtype]?.find(a => a.slug == ability.slug)) return;
                    abilities[subtype].splice(index, 1);
                    if (targetIndex !== undefined) abilities[itemSubtype].splice(targetIndex, 0, ability);
                    else abilities[itemSubtype].push(ability);
                    return this.item.update({"system.abilities": abilities});
                }
            }

            if (category == "move") {
                // Must be dropped within the move zone or on a known move subtype
                if (targetZone != "move" && !["level", "machine", "tutor", "egg"].includes(targetSubtype)) return;
                if (!itemSubtype) return;

                // re-order within same subtype
                if (itemSubtype == subtype) {
                    const moves = this.item.system.moves;
                    const move = moves[subtype][index];
                    if (!move) return;
                    moves[subtype].splice(index, 1);
                    moves[subtype].splice(targetIndex ?? moves[subtype].length, 0, move);
                    return this.item.update({"system.moves": moves});
                }
                // move to different subtype
                else {
                    const moves = this.item.system.moves;
                    const move = moves[subtype][index];
                    if (!move || moves[itemSubtype]?.find(m => m.slug == move.slug)) return;
                    if (subtype == "level") delete move.level;
                    if (itemSubtype == "level") move.level = 1;
                    moves[subtype].splice(index, 1);
                    if (targetIndex !== undefined) moves[itemSubtype].splice(targetIndex, 0, move);
                    else moves[itemSubtype].push(move);
                    return this.item.update({"system.moves": moves});
                }
            }

            return;
        }

        // External drops: compendium browser, world sidebar, other species sheets, actor sheets, etc.
        if (data.type == "Item" && data.uuid) {
            const item = await fromUuid(data.uuid);

            if (!item) return;
            if (!this.allowedDropTypes.includes(item.type)) return;

            switch (item.type) {
                case "capability": {
                    const otherCapabilities = this.item.system.capabilities.other ?? [];
                    if (otherCapabilities.find(c => c.slug == item.slug)) return;
                    otherCapabilities.push({slug: item.slug, uuid: item.uuid});
                    return this.item.update({"system.capabilities.other": otherCapabilities});
                }
                case "ability": {
                    const abilities = this.item.system.abilities;
                    if (abilities.basic?.find(a => a.slug == item.slug)) return;
                    if (abilities.advanced?.find(a => a.slug == item.slug)) return;
                    if (abilities.high?.find(a => a.slug == item.slug)) return;

                    // Route to the section the user dropped onto; default to basic
                    const subtype = (targetZone == "ability" || ["basic", "advanced", "high"].includes(targetSubtype))
                        ? (targetSubtype ?? "basic") : "basic";
                    abilities[subtype].push({slug: item.slug, uuid: item.uuid});
                    return this.item.update({"system.abilities": abilities});
                }
                case "move": {
                    const moves = this.item.system.moves;
                    // Route to the section the user dropped onto; default to level
                    const subtype = (targetZone == "move" || ["machine", "tutor", "egg"].includes(targetSubtype))
                        ? (targetSubtype ?? "level") : "level";

                    if (moves[subtype]?.find(m => m.slug == item.slug)) return;
                    if (subtype == "level") {
                        moves.level.unshift({uuid: item.uuid, slug: item.slug, level: Number(data.level) || 1});
                    } else {
                        moves[subtype].push({uuid: item.uuid, slug: item.slug});
                    }
                    return this.item.update({"system.moves": moves});
                }
                case "species": {
                    const evolutions = this.item.system.evolutions;
                    if (evolutions.find(e => e.slug == item.slug)) return;
                    const level = item.system?.evolutions?.find(e => e.slug == item.slug)?.level ?? 0;
                    const evolutionItem = item.system?.evolutions?.find(e => e.slug == item.slug)?.other?.evolutionItem ?? undefined;
                    const restrictions = item.system?.evolutions?.find(e => e.slug == item.slug)?.other?.restrictions ?? [];
                    evolutions.push({level, slug: item.slug, uuid: item.uuid, other: {evolutionItem, restrictions}});
                    return this.item.update({"system.evolutions": evolutions});
                }
                case "item": {
                    // Evolution item drop — must land on a specific evolution-item drop zone
                    const evolutionEl = event.target.closest('[data-index]');
                    const index = evolutionEl?.dataset.index ?? event.currentTarget?.dataset.index;
                    if (index === undefined) return;
                    const evolutions = this.item.system.evolutions;
                    if (evolutions[index]?.other?.evolutionItem?.slug == item.slug) return;
                    evolutions[index].other.evolutionItem = {slug: item.slug, uuid: item.uuid};
                    return this.item.update({"system.evolutions": evolutions});
                }
            }
        }
    }

    /** @override */
    _updateObject(event, formData) {
        const expanded = foundry.utils.expandObject(formData);

        const types = [...new Set(Object.values(expanded.system.type))].filter(type => type != "Untyped" && type != "");
        if(types.length == 0) types.push("Untyped");
        expanded.system.types = types;

        if(expanded.system.capabilities?.naturewalk) {
            expanded.system.capabilities.naturewalk = Array.isArray(expanded.system.capabilities.naturewalk) ? expanded.system.capabilities.naturewalk : expanded.system.capabilities.naturewalk.split(",").map(naturewalk => naturewalk.trim());
        }
        if(expanded.system.breeding?.eggGroups) {
            expanded.system.breeding.eggGroups = Array.isArray(expanded.system.breeding.eggGroups) ? expanded.system.breeding.eggGroups : expanded.system.breeding.eggGroups.split(",").map(eggGroup => eggGroup.trim());
        }
        if(expanded.system.habitats) {
            expanded.system.habitats = Array.isArray(expanded.system.habitats) ? expanded.system.habitats : expanded.system.habitats.split(",").map(habitat => habitat.trim());
        }
        if(expanded.system.diet) {
            expanded.system.diet = Array.isArray(expanded.system.diet) ? expanded.system.diet : expanded.system.diet.split(",").map(diet => diet.trim());
        }
        
        if(expanded.system.moves?.level) {
            const moves = Object.values(expanded.system.moves.level)
                .map(move => {
                    if(!move.level) move.level = 1;
                    if(move.level && !isNaN(Number(move.level))) {
                        move.level = Number(move.level);
                    }
                    else {
                        if(""+move.level.toLowerCase() != "evo" ) move.level = "Evo";
                    }
                    return move;
                })
                .sort((a, b) => {
                    // if both levels are numbers compare
                    if(!isNaN(Number(a.level)) && !isNaN(Number(b.level))) {
                        return Number(a.level) - Number(b.level);
                    }
                    // if one of them is the string 'evo' put it first
                    if((""+a.level).toLowerCase() == "evo") return -1;
                    if((""+b.level).toLowerCase() == "evo") return 1;

                    // otherwise throw error
                    throw new Error("Invalid level");
                });
            expanded.system.moves.level = moves;
        }

        if(expanded.system.evolutions) {
            const evolutions = Object.values(expanded.system.evolutions)
                .map(evolution => {
                    if(evolution.level && !isNaN(Number(evolution.level))) {
                        evolution.level = Number(evolution.level);
                    }
                    else {
                        evolution.level = 1;
                    }
                    return evolution;
                });
            for(let i = 0; i < evolutions.length; i++) {
                evolutions[i].other.restrictions = Array.isArray(expanded.system.evolutions[i].other.restrictions) ? expanded.system.evolutions[i].other.restrictions : expanded.system.evolutions[i].other.restrictions.split(",").map(restriction => restriction.trim());
                evolutions[i].other.evolutionItem = this.item.system.evolutions[i].other.evolutionItem;
            }

            expanded.system.evolutions = evolutions.sort((a, b) => a.level - b.level);
        }

        return super._updateObject(event, foundry.utils.flattenObject(expanded));
    }

    /** @override */
    _canUserView(user) {
        return true;
    }
}

export { PTUSpeciesSheet }