import { ActorConfig } from "./sheet/actor-config.js";

class PTUActorSheet extends foundry.appv1.sheets.ActorSheet {
    /** @override */
    _getHeaderButtons() {
        const buttons = super._getHeaderButtons();
        const sheetButton = buttons.find((button) => button.class === "configure-sheet");
        const hasMultipleSheets = Object.keys(CONFIG.Actor.sheetClasses[this.actor.type]).length > 1;
        if (!hasMultipleSheets && sheetButton) {
            buttons.splice(buttons.indexOf(sheetButton), 1);
        }

        if (this.isEditable) {
            const index = buttons.findIndex((b) => b.class === "close");
            buttons.splice(index, 0, {
                label: "Configure", // Top-level foundry localization key
                class: "configure-creature",
                icon: "fas fa-cog",
                onclick: () => this._onConfigureActor(),
            });

            // Add a button to heal the character as if Pokecenter Healing was done
            buttons.unshift({
                label: "Heal",
                class: "heal-character",
                icon: "fas fa-heart",
                onclick: async () => {
                    const hp = this.actor.system.health.value;
                    const maxHp = this.actor.system.health.max;
                    const totalHp = this.actor.system.health.total;
                    const injuries = this.actor.system.health.injuries;
                    const pp = this.actor.system.pp.value;
                    const maxPp = this.actor.system.pp.max;
                    if(injuries === 0 && hp === maxHp && pp === maxPp) return ui.notifications.info(`${this.actor.name} is already at full health!`);
                    if(injuries <= 3) {
                        await this.actor.update({
                            "system.health.value": totalHp,
                            "system.health.injuries": 0,
                            "system.pp.value": maxPp
                        });
                        await ChatMessage.create({
                            speaker: {alias: this.actor.name},
                            content: `${this.actor.name} was healed to full health! (${hp} -> ${totalHp}) and healed ${injuries} injuries! (${injuries} -> 0) and restored PP! (${pp} -> ${maxPp})`
                        })
                    } 
                    else {
                        await this.actor.update({
                            "system.health.injuries": Math.max(0, injuries - 3)
                        })

                        const newMax = this.actor.system.health.max;
                        await this.actor.update({
                            "system.health.value": newMax,
                            "system.pp.value": maxPp
                        });
                        await ChatMessage.create({
                            speaker: {alias: this.actor.name},
                            content: `${this.actor.name} was healed to full health! (${hp} -> ${newMax}) and healed 3 injuries! (${injuries} -> ${Math.max(0, injuries - 3)}) and restored PP! (${pp} -> ${maxPp})`
                        })
                    }
                }
            })
        }

        // Add notes button
        buttons.unshift({
            label: "Notes",
            class: "open-notes",
            icon: "fas fa-book",
            onclick: () => this.openNotes(),
        })

        return buttons;
    }

    _onConfigureActor() {
        new ActorConfig(this.actor).render(true);
    }

    
	/** @override */
	async getData() {
		const data = await super.getData();
		data.config = CONFIG.PTU.data;
		data.ppVariant = game.settings.get("ptu", "variant.usePP");
        return data;
    }

    /** Emulate a sheet item drop from the canvas */
    async emulateItemDrop(data) {
        return this._onDropItem({ preventDefault: () => { } }, data);
    }

    /**
     * Find a real owned item by its _id or, for struggle items, by its synthetic realId.
     * @param {string} itemId  The data-item-id (may be an _id or a struggle realId like "struggle-normal-physical")
     * @returns {Item|null}
     */
    _getOwnedItemByRealId(itemId) {
        return this.actor.items.get(itemId)
            ?? this.actor.items.find(i => i.realId === itemId)
            ?? null;
    }

    /**
     * Materialize a phantom item: create it as a real owned item on the actor and return it.
     * Phantom items are synthetic items shown on the sheet but not persisted to the database.
     * @param {string} itemId  The data-item-id of the phantom item (struggle realId or spirit action compendium _id)
     * @returns {Promise<Item|null>}
     */
    async _materializePhantomItem(itemId) {
        // Actor-level phantoms: struggle variants registered in prepareMoves
        const actorPhantom = this.actor.phantomItems?.get(itemId);
        // Sheet-level phantoms: spirit actions added in getData
        const sheetPhantom = this._phantomSpiritActions?.get(itemId);

        const phantom = actorPhantom ?? sheetPhantom;
        if (!phantom) return null;

        let itemData;

        if (actorPhantom) {
            // For struggle phantoms, build a typed copy from the compendium base entry
            const ptuFlags = actorPhantom.flags?.ptu ?? {};
            const sourceUuid = ptuFlags.sourceUuid;
            const variantData = ptuFlags.phantomData;

            const baseItem = sourceUuid ? await fromUuid(sourceUuid) : null;
            if (baseItem && variantData) {
                itemData = baseItem.toObject();
                // Apply variant-specific overrides
                itemData.name = variantData.name;
                itemData.img = variantData.img;
                itemData.system.type = variantData.type;
                itemData.system.category = variantData.category;
                itemData.system.range = variantData.range;
                itemData.system.ac = variantData.ac;
                itemData.system.damageBase = variantData.damageBase;
                itemData.system.isStruggle = true;
                itemData.system.isRangedStruggle = variantData.isRangedStruggle ?? false;
            } else {
                // Fallback: use the phantom's own data directly
                itemData = actorPhantom.toObject();
            }
        } else {
            // Spirit action phantoms are plain data objects stored in _phantomSpiritActions
            itemData = foundry.utils.duplicate(sheetPhantom);
        }

        // Strip phantom metadata so the created item is a normal owned item
        delete itemData._id;
        if (itemData.flags?.ptu) {
            delete itemData.flags.ptu.phantom;
            delete itemData.flags.ptu.sourceUuid;
            delete itemData.flags.ptu.phantomData;
        }

        const [created] = await this.actor.createEmbeddedDocuments('Item', [itemData]);
        return created ?? null;
    }

    async openNotes() {
        const folder = await (async () => {
            const folderId = game.settings.get("ptu", "worldNotesFolder");
            if (!folderId) {
                if (game.user.isGM) return game.ptu.macros.initializeWorldNotes();
                else return null;
            }

            const folder = game.folders.get(folderId);
            if (!folder) {
                if (game.user.isGM) return game.ptu.macros.initializeWorldNotes();
                else return null;
            }

            return folder;
        })();
        if (!folder) return ui.notifications.error("No folder found for world notes; Please ask your GM to login and not to delete the folder \"Actor Notes\"");

        const journalEntry = await (async () => {
            const journalId = this.actor.getFlag("ptu", "notesId");
            if (!journalId) {
                const journal = await JournalEntry.create({
                    name: this.actor.name,
                    folder: folder.id,
                    ownership: this.actor.ownership,
                    pages: [
                        {
                            name: "Notes",
                            type: "text",
                            ownership: this.actor.ownership,
                            text: {
                                format: 1,
                                content: this.actor.system.notes || ""
                            }
                        }
                    ]
                });
                await this.actor.setFlag("ptu", "notesId", journal.id);
                return journal;
            }

            const journal = await fromUuid(`JournalEntry.${journalId}`);
            if (!journal) {
                await this.actor.unsetFlag("ptu", "notesId");
                return this.openNotes();
            }

            return journal;
        })();
        if (!journalEntry) return;

        journalEntry.sheet.render(true);
    }

    /** @override */
    async _onDrop(event) {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        const actor = this.actor;
        const allowed = Hooks.call("dropActorSheetData", actor, this, data);
        const target = event.target;
        if (allowed === false) return;

        // Case 1 - Money
        if (data.type === "pokedollar") {
            const amount = parseInt(data.data.amount);
            if (!amount) return ui.notifications.error("Invalid amount of money dropped");

            if (data.data.item) {
                const item = await fromUuid(data.data.item);
                if (!item) return ui.notifications.error("Invalid item dropped");

                if ((actor.system.money ?? 0) < amount) return ui.notifications.error(`${actor.name} does not have enough money to pay for ${item.name} (Cost: ${amount} Poké, Current: ${actor.system.money})`);
                await actor.update({
                    "system.money": actor.system.money - amount,
                });
                // If duplicate item gets added instead increase the quantity
                const existingItem = actor.items.getName(item.name);
                if (existingItem && existingItem.system.quantity) {
                    const quantity = foundry.utils.duplicate(existingItem.system.quantity);
                    await existingItem.update({ "system.quantity": Number(quantity) + (item.system.quantity > 0 ? Number(item.system.quantity) : 1) });
                }
                else {
                    await Item.create(item.toObject(), { parent: actor });
                }
                return ui.notifications.info(`${actor.name} Paid ${amount} Poké for ${item.name} (New Total: ${actor.system.money})`);
            }
            await actor.update({
                "system.money": actor.system.money + amount
            });
            return ui.notifications.info(`${actor.name} Gained ${amount} Poké (New Total: ${actor.system.money})`);
        }
        // Case 2 - Items (including effects and conditions)
        else if (data.type === "Item" && data.uuid) {
            const item = await fromUuid(data.uuid);
            if (!item) return ui.notifications.error("Invalid item dropped");

            // Special handling for effects and conditions
            if (item.type === "effect" || item.type === "condition") {
                try {
                    // Check if the item has an apply method (for effects/conditions)
                    if (typeof item.apply === "function") {
                        await item.apply([actor]);
                        return ui.notifications.info(`Applied ${item.name} to ${actor.name}`);
                    } else {
                        // Fallback: create the item on the actor
                        await actor.createEmbeddedDocuments("Item", [item.toObject()]);
                        return ui.notifications.info(`Added ${item.name} to ${actor.name}`);
                    }
                } catch (error) {
                    console.error("PTU | Error applying effect/condition:", error);
                    ui.notifications.error(`Failed to apply ${item.name} to ${actor.name}`);
                    return false;
                }
            }
            // For other items, use the standard drop handling
            const fakeEvent = new Event("drop"); // For some reason, the event loses its data when passed to the item drop handler, so we have to create a new one and attach the data manually
            Object.defineProperty(fakeEvent, "target", {
                get: () => target,
            })
            Object.defineProperty(fakeEvent, "dataTransfer", {
                value: {
                    getData: () => JSON.stringify({ type: "Item", uuid: data.uuid }),
                },
            });
            return super._onDrop(fakeEvent);
        }
        else {
            return super._onDrop(event);
        }
    }
}

export { PTUActorSheet }