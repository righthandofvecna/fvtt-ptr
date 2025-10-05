import { Progress } from "../../../util/progress.js";

class PTUPokemonTrainingSheet extends FormApplication {
    constructor({ actor, ...options } = {}) {
        if (!actor) throw new Error("PTU.PokemonTrainingSheet.NoActor");
        super(options);

        this.trainer = null;
        this.party = null;
        this.training = [];
        this.instancesOfTraining = 6;
        this._prepare(actor, options.strict);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            title: "PTU.PokemonTrainingSheet.Title",
            classes: ["ptu", "sheet", "party", "training"],
            width: 637,
            height: 600,
            template: 'systems/ptu/static/templates/apps/pokemon-training-sheet.hbs',
            dragDrop: [
                { dragSelector: ".party-list .party-item.draggable", dropSelector: ".party-list.droppable" },
                { dragSelector: undefined, dropSelector: '.party-list.droppable' },
                { dragSelector: undefined, dropSelector: undefined }
            ],
            resizable: true,
            submitOnChange: false,
            submitOnClose: false,
            closeOnSubmit: false,
        });
    };

    /** @override */
    _updateObject(event, formData) {
        // This is the method called back from the training call via the form
        console.log(formData);
        let trainingType = formData["training"];
        console.log(trainingType);
        delete formData["training"];
        this.completeTraining(trainingType, formData);
    }

    /** @override */
    _canDragStart(selector) {
        return this.isEditable;
    }
    /** @override */
    _canDragDrop(selector) {
        return this.isEditable;
    }

    getData() {
        const data = super.getData();

        const averageLevelOfMons = monArray => (
            monArray.reduce(
                (a, b) => a + (b.attributes.level.current ?? 0),
                0
            ) / monArray.length
        ).toFixed(1);

        data.trainer = this.trainer;
        data.selectedToTrain = {};
        data.xpToDistribute = this.xpToDistribute;
        data.boxes = {
            training: {
                contents: this.training,
                metric: this.instancesOfTraining * this.xpToDistribute,
                xpinstance: this.xpToDistribute,
                instances: this.instancesOfTraining
            },
            party: {
                contents: this.party,
                metric: this.party?.length > 0 ? averageLevelOfMons(this.party) : undefined
            },
            boxed: {
                contents: this.boxed,
                metric: this.boxed?.length > 0 ? averageLevelOfMons(this.boxed) : undefined
            },
        }
        if(this.available?.length > 0) {
            data.boxes.available = {
                contents: this.available,
                metric: averageLevelOfMons(this.available)
            }
        }

        for (const child of this.trainer.folder.children) {
            if ([this.folders.party?.id, this.folders.box?.id].includes(child.folder.id)) continue;
            const slug = CONFIG.PTU.util.sluggify(child.folder.name);
            data.boxes[slug] = {
                contents: child.entries.filter(actor => actor.type == "pokemon"),
            }
            data.boxes[slug].metric = data.boxes[slug].contents?.length > 0 ? averageLevelOfMons(data.boxes[slug].contents) : undefined;
            this.folders[slug] = child.folder;
        }

        return data;
    }

    _prepare(actor, strict = true) {
        this.#setTrainer(actor, strict);
        if (!this.trainer) return;
        this.#loadFolders(strict);
        if (!this.folders) return;
        this.#loadParty(strict);
        this.#loadBox(strict);
        this.#loadAvailable(strict);
        this.#calculateXPToDistribute();
        this.#setPokemonToTrain(strict);
    }

    #setTrainer(actor, strict) {
        // If the actor is a pokemon, we need to get the trainer
        if (actor.type == "pokemon") {
            // if a trainer is set, get the actor
            if (actor.flags?.ptu?.party?.trainer) {
                this.trainer = game.actors.get(actor.flags.ptu.party.trainer);
                return;
            }

            // Otherwise, try find the trainer from the user
            if (game.user.character && game.user.character.type == "character") {
                this.trainer = game.user.character;
                return;
            }

            // Otherwise, attempt to find the trainer from ownership permissions
            const pool = [];
            for (const [owner, value] of Object.entries(actor.ownership)) {
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

            if (strict) {
                ui.notifications.error("PTU.PartySheet.NoTrainer", { localize: true });
                throw new Error("PTU.PartySheet.NoTrainer");
            }
            return;
        }

        // Otherwise the actor is our trainer
        this.trainer = actor;
        return;
    }

    #loadFolders(strict) {
        // Get available folders from the trainer's folder
        const trainerFolder = this.trainer.folder;
        if (!trainerFolder) {
            if (strict) {
                ui.notifications.error("PTU.PartySheet.NoFolder", { localize: true });
                throw new Error("PTU.PartySheet.NoFolder");
            }
            return;
        };

        const party = trainerFolder.children.find(folder => folder.folder.name == "Party")?.folder ?? game.folders.find(folder => folder.name == "Party" && folder._source.folder == trainerFolder.id);
        const box = trainerFolder.children.find(folder => folder.folder.name == "Box")?.folder ?? game.folders.find(folder => folder.name == "Box" && folder._source.folder == trainerFolder.id);

        this.folders = {
            root: trainerFolder,
            party,
            box
        }

        if (!party) {
            // Create the party folder
            Folder.create({ name: "Party", type: "Actor", folder: trainerFolder.id })
                .then(folder => {
                    this.folders.party = folder;
                })
                // Move all pokemon in the trainer's folder to the party folder
                .then(async () => {
                    const partyFolder = this.folders.party;
                    const party = game.actors.filter(actor =>
                        actor.type == "pokemon" &&
                        actor.flags?.ptu?.party?.trainer == this.trainer.id &&
                        !actor.flags?.ptu?.party?.boxed);

                    const available = trainerFolder.contents.filter(actor => actor.type == "pokemon" && !actor.flags?.ptu?.party?.trainer) ?? [];
                    for (const mon of available) {
                        if (mon.folder.id == partyFolder.id) continue;
                        await mon.update({
                            "folder": partyFolder.id,
                            "flags.ptu.party.trainer": this.trainer.id,
                            "flags.ptu.party.boxed": false
                        });
                    };
                    for (const mon of party) {
                        if (mon.folder.id == partyFolder.id) continue;
                        await mon.update({ "folder": partyFolder.id });
                    }

                    this.#loadAvailable();
                    this.#loadParty();
                    await this.render(true);
                })
        }
        if (!box) {
            // Create the box folder
            Folder.create({ name: "Box", type: "Actor", folder: trainerFolder.id })
                .then(folder => {
                    this.folders.box = folder;
                })
                // Move all pokemon with the boxed flag to the box folder
                .then(async () => {
                    const box = this.folders.box;
                    const boxed = game.actors.filter(actor =>
                        actor.type == "pokemon" &&
                        actor.flags?.ptu?.party?.trainer == this.trainer.id &&
                        actor.flags?.ptu?.party?.boxed);
                    for (const mon of boxed) {
                        if (mon.folder.id == box.id) continue;
                        await mon.update({ "folder": box.id });
                    }

                    this.#loadAvailable();
                    this.#loadBox();
                    await this.render(true);
                })
        }
    }

    #loadParty() {
        // If the trainer has a party folder, get the pokemon from the folder
        if (this.folders.party) {
            const party = this.folders.party.contents.filter(actor => actor.type == "pokemon");
            this.party = party;
            return;
        }
        // Otherwise, get the pokemon from the flag
        const party = game.actors.filter(actor =>
            actor.type == "pokemon" &&
            actor.flags?.ptu?.party?.trainer == this.trainer.id &&
            !actor.flags?.ptu?.party?.boxed);

        this.party = party;
    }

    #loadBox() {
        // If the trainer has a box, get the pokemon from the box
        if (this.folders.box) {
            const boxed = this.folders.box.contents.filter(actor => actor.type == "pokemon");
            this.boxed = boxed;
            return;
        }
        // Otherwise, get the pokemon from the flag
        const boxed = game.actors.filter(actor =>
            actor.type == "pokemon" &&
            actor.flags?.ptu?.party?.trainer == this.trainer.id &&
            actor.flags?.ptu?.party?.boxed);

        this.boxed = boxed;
    }

    #loadAvailable() {
        // Load available pokemon located in the trainer's folder
        const folder = this.folders.root;

        const available = folder.contents.filter(actor => actor.type == "pokemon" && !actor.flags?.ptu?.party?.trainer) ?? [];
        this.available = available;
    }

    #calculateXPToDistribute() {
        // Calculates the XP To Distribute using proper trainer data
        try {
            // Use the trainer's dedicated method to get proper EXP training data
            const expTrainingData = this.trainer.getExpTrainingData();
            
            // The expTrainingLevelCap is already calculated as: level * (2 + (2 * milestones))
            // This is exactly what we need for XP distribution per instance
            this.xpToDistribute = expTrainingData.expTrainingLevelCap;
            
            console.log('EXP Training Data:', expTrainingData);
            console.log('XP to distribute per instance:', this.xpToDistribute);
        } catch (error) {
            console.error('Error calculating XP to distribute:', error);
            
            // Fallback to basic calculation if the method fails
            const currentTrainerLevel = this.trainer.system.level.current || 1;
            const milestones = this.trainer.system.level.milestones || 0;
            this.xpToDistribute = currentTrainerLevel * (2 + (2 * milestones));
            
            console.log('Using fallback calculation - Level:', currentTrainerLevel, 'Milestones:', milestones, 'XP:', this.xpToDistribute);
        }
    }

    #setPokemonToTrain() {
        // Initializes the selected pokemon
        this.selectedPokemon = [];
    }

    /** @override */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();

        buttons.unshift({
            label: "PTU.PokemonTrainingSheet.AutoDistributeXP",
            class: "training-autoexp",
            icon: "fas fa-robot",
            onclick: this.autoDistributeXP.bind(this)
        });

        return buttons;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        html.find('.party-list.droppable').on('dragover', (event) => {
            event.preventDefault();
            event.currentTarget.classList.add("dragover");
        });

        html.find('.party-list.droppable').on('dragleave', (event) => {
            event.preventDefault();
            event.currentTarget.classList.remove("dragover");
        });

        html.find(".party-item[data-actor-uuid]").on('dblclick', async (event) => {
            event.preventDefault();
            const actor = await fromUuid(event.currentTarget.dataset.actorUuid);
            actor?.sheet?.render(true);
        })
    }

    /** @override */
    _onDragStart(event) {
        const li = event.currentTarget;
        const { actorUuid, partyStatus, actorIndex } = li.dataset;

        event.dataTransfer.setData('text/plain', JSON.stringify({
            uuid: actorUuid,
            type: partyStatus,
            index: actorIndex
        }));
    }

    /** @override */
    async _onDrop(event) {
        const data = JSON.parse(event.dataTransfer.getData('text/plain'));
        $(event.currentTarget)?.find('.item-list')?.removeClass("dragover");

        if (data.type == "Actor" && data.uuid) { 
            if (this.handledDrop) return;
            const actor = await fromUuid(data.uuid);

            if (!actor) return;
            if (actor.type != "pokemon") return;

            // If the actor is already in the party, do nothing
            if (actor.flags?.ptu?.party?.trainer == this.trainer.id) return;

            const { partyStatus } = event.currentTarget?.dataset ?? {};

            this.handledDrop = true;
            // If the drop was targeted on a specific area, add the actor to that area
            if (partyStatus) {
                switch (partyStatus) {
                    case "available": {
                        const folder = this.folders.root;

                        if (actor.folder?.id != folder.id) {
                            await actor.update({ folder: folder.id });
                        }
                        if (actor.flags?.ptu?.party?.trainer) {
                            await actor.unsetFlag("ptu", "party");
                        }

                        this.available.push(actor);
                        this.handledDrop = false;
                        return this.render();
                    }
                    case "party": {
                        let folder = this.folders.party;
                        if (!folder) {
                            folder = await Folder.create({ name: "Party", type: "Actor", folder: this.folders.root.id });
                        }

                        if (actor.folder?.id != folder.id) {
                            await actor.update({ folder: folder.id });
                        }
                        await actor.setFlag("ptu", "party", { trainer: this.trainer.id, boxed: false });

                        this.party.push(actor);
                        this.available = this.available.filter(a => a.uuid != actor.uuid);
                        this.handledDrop = false;
                        return this.render();
                    }
                    case "boxed": {
                        let folder = this.folders.box;
                        if (!folder) {
                            folder = await Folder.create({ name: "Box", type: "Actor", folder: this.folders.root.id });
                        }

                        if (actor.folder?.id != folder.id) {
                            await actor.update({ folder: folder.id });
                        }
                        await actor.setFlag("ptu", "party", { trainer: this.trainer.id, boxed: true });

                        this.boxed.push(actor);
                        this.available = this.available.filter(a => a.uuid != actor.uuid);
                        this.handledDrop = false;
                        return this.render();
                    }
                    case "training": {
                        // Check if Pokemon is eligible for training
                        const currentLevel = actor.system.level.current;
                        const trainingLevelCap = actor.attributes.level.cap.training;
                        
                        if (currentLevel > trainingLevelCap) {
                            ui.notifications.warn(`${actor.name} is too high level (${currentLevel}) for training. Maximum level: ${trainingLevelCap}`);
                            this.handledDrop = false;
                            return this.render();
                        }
                        break;
                    }
                    default: {
                        const folder = this.folders[partyStatus];
                        if(!folder) return ui.notifications.error("Invalid folder");

                        if (actor.folder?.id != folder.id) {
                            await actor.update({ folder: folder.id });
                        }
                        await actor.setFlag("ptu", "party", { trainer: this.trainer.id, boxed: true });

                        this.handledDrop = false;
                        return this.render();
                    }
                }

            }
            else {
                // Otherwise, add the actor to the party if there is space
                if (this.party.length < 6) {
                    let folder = this.folders.party;
                    if (!folder) {
                        folder = await Folder.create({ name: "Party", type: "Actor", folder: this.folders.root.id });
                    }

                    if (actor.folder?.id != folder.id) {
                        await actor.update({ folder: folder.id });
                    }
                    await actor.setFlag("ptu", "party", { trainer: this.trainer.id, boxed: false });

                    this.party.push(actor);
                    this.available = this.available.filter(a => a.uuid != actor.uuid);
                }
                else {
                    let folder = this.folders.box;
                    if (!folder) {
                        folder = await Folder.create({ name: "Box", type: "Actor", folder: this.folders.root.id });
                    }

                    if (actor.folder?.id != folder.id) {
                        await actor.update({ folder: folder.id });
                    }
                    await actor.setFlag("ptu", "party", { trainer: this.trainer.id, boxed: true });

                    this.boxed.push(actor);
                    this.available = this.available.filter(a => a.uuid != actor.uuid);
                }

                this.handledDrop = false;
                return this.render();
            }
        }

        // If there is no partyStatus this already ran so ignore
        if (!event.currentTarget?.dataset?.partyStatus) return;

        const { uuid, type, index } = data;
        const { partyStatus } = event.currentTarget.dataset;
        const actor = await fromUuid(uuid);

        if (!actor) return;
        if (actor.type != "pokemon") return;
        if (data.type === "training") {
            if (partyStatus !== "training") {
                let pokemonIndex = this.training.indexOf(actor);
                if (pokemonIndex !== -1) {
                    if (this.training.length === 1) {
                        this.training = [];
                    }
                    this.training.splice(pokemonIndex, 1);
                }
            }
            return this.render();
        }

        // Main logic for dragging, most of which is largely unchanged from the Party sheet
        switch (partyStatus) {
            case "available": {
                const folder = this.folders.root;

                if (actor.folder?.id != folder.id) {
                    await actor.update({ folder: folder.id });
                }
                if (actor.flags?.ptu?.party?.trainer) {
                    await actor.unsetFlag("ptu", "party");
                }

                this[type].splice(index, 1);
                this.available.push(actor);
                return this.render();
            }
            case "party": {
                let folder = this.folders.party;
                if (!folder) {
                    folder = await Folder.create({ name: "Party", type: "Actor", folder: this.folders.root.id });
                }

                if (actor.folder?.id != folder.id) {
                    await actor.update({ folder: folder.id });
                }
                await actor.setFlag("ptu", "party", { trainer: this.trainer.id, boxed: false });

                this[type].splice(index, 1);
                this.party.push(actor);
                return this.render();
            }
            case "boxed": {
                let folder = this.folders.box;
                if (!folder) {
                    folder = await Folder.create({ name: "Box", type: "Actor", folder: this.folders.root.id });
                }

                if (actor.folder?.id != folder.id) {
                    await actor.update({ folder: folder.id });
                }
                await actor.setFlag("ptu", "party", { trainer: this.trainer.id, boxed: true });

                this[type].splice(index, 1);
                this.boxed.push(actor);
                return this.render();
            }
            // Checks if you can add the pokemon to the training list
            case "training": {
                // Check if Pokemon is eligible for training
                const currentLevel = actor.system.level.current;
                const trainingLevelCap = actor.attributes.level.cap.training;
                
                if (currentLevel > trainingLevelCap) {
                    ui.notifications.warn(`${actor.name} is too high level (${currentLevel}) for training. Maximum level: ${trainingLevelCap}`);
                    return this.render();
                }
                
                if (this.training.length < 6) {
                    if (this.training.indexOf(actor) === -1) {
                        this.training.push(actor);
                    } else {
                        console.log("Pokemon already selected for training");
                    }
                }

                return this.render();
            }
            default: {
                const folder = this.folders[partyStatus];
                if(!folder) return ui.notifications.error("Invalid folder");

                if (actor.folder?.id != folder.id) {
                    await actor.update({ folder: folder.id });
                }
                await actor.setFlag("ptu", "party", { trainer: this.trainer.id, boxed: true });

                this[type]?.splice?.(index, 1);
                return this.render();
            }
        }
    }

    autoDistributeXP() {
        // Auto Distributes the XP across the selected pokemon evenly for each instances.
        let inputFields = document.querySelectorAll('[id*="xp-for-"]');
        if (inputFields.length === 0) {
            return;
        }

        let totalNumberOfPokemon = inputFields.length;
        let xpToDistribute = this.xpToDistribute * (Math.floor(this.instancesOfTraining / totalNumberOfPokemon));
        let extraInstances = this.instancesOfTraining % totalNumberOfPokemon;
        for (let i = 0; i < totalNumberOfPokemon; i++) {
            let xpForPokemon = (i < extraInstances) ? xpToDistribute + (this.xpToDistribute) : xpToDistribute;
            inputFields[i].value = xpForPokemon;
        }
    }

    completeTraining(trainingType, trainingData) {
        // Finalizes the training and messages the GM
        let trainingEffectID = this.getTrainingEffect(trainingType);
        let message = this.trainer.name + " has completed their daily training!<br>";
        Object.entries(trainingData).forEach(([key, value]) => {
            console.log(key, value);
            let actor = game.actors.get(key);
            
            // Check if Pokemon is eligible for training
            const currentLevel = actor.system.level.current;
            const trainingLevelCap = actor.attributes.level.cap.training;
            const trainingAmountCap = actor.attributes.level.cap.amount;
            const expValue = parseInt(value) || 0;
            
            if (currentLevel > trainingLevelCap) {
                message += `${actor.name} is too high level (${currentLevel}) for training (cap: ${trainingLevelCap})<br>`;
                return;
            }
            
            // Cap the EXP to the training amount limit
            const actualExpGained = Math.min(expValue, trainingAmountCap);
            if (actualExpGained < expValue) {
                message += `${actor.name} EXP capped from ${expValue} to ${actualExpGained} (training cap: ${trainingAmountCap})<br>`;
            }
            
            console.log(actor.name, actor.xp);
            console.log(actor.system.level.exp, actor.system.level.exp + actualExpGained);
            let updatedXP = actor.system.level.exp + actualExpGained;
            message += actor.name + " gained " + actualExpGained + " EXP totaling to " + updatedXP + " EXP<br>";
            actor.update({'system.level.exp' : updatedXP});
            
            if (trainingEffectID !== "") {
                (async (effect) => {
                    effect = await game.packs.get("ptu.effects").getDocument(trainingEffectID);
                    await actor.createEmbeddedDocuments('Item', [effect]);
                })(trainingEffectID);
            }
        });

        this.sendChatMessage(message);
    }

    getTrainingEffect(trainingType) {
        switch (trainingType) {
            case "agility-training": {
                return "dxO8qRP5QvYxVXxH";
            }
            case "brutal-training": {
                return "GeViS4FLUZheGYB2";
            }
            case "focused-training": {
                return "Zg1mu7XntZ0YInPU";
            }
            case "inspired-training": {
                return "C5YgcvxK8CyqLXji";
            }
            default: {
                return "";
            }
        }
    }

    sendChatMessage(message) {
         ChatMessage.create({
            whisper: ChatMessage.getWhisperRecipients('GM'),
            content: message,
        });
    }
}

export { PTUPokemonTrainingSheet }
