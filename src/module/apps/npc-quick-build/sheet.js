import { NpcQuickBuildData } from "./document.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class PTUNpcQuickBuild extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: "npc-quick-build",
        classes: ["ptu", "pokemon", "npc-quick-build"],
        position: {
            width: 660,
            height: "auto",
        },
        window: {
            title: "NPC Quick Build",
            minimizable: true,
            resizable: false,
            controls: [
                {
                    icon: "fas fa-dice",
                    label: "Randomize",
                    action: "randomize",
                },
            ],
        },
        actions: {
            randomize: async function () {
                await this.loading();
                await this.data.randomizeAll();
                this.render(true);
            },
        },
    };

    static PARTS = {
        content: {
            template: "systems/ptu/static/templates/apps/npc-quick-build-sheet.hbs",
        },
    };

    #isGenerating = false;

    constructor(options = {}) {
        super(options);
        this.data = new NpcQuickBuildData();
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        await this.data.refresh();

        const allianceOptions = {
            party: "PTU.Alliance.Party",
            opposition: "PTU.Alliance.Opposition",
            neutral: "PTU.Alliance.Neutral"
        };

        return {
            ...context,
            config: CONFIG.PTU.data,
            allianceOptions,
            data: this.data,
        };
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        // Remove any loading overlay left from a prior async operation
        this.element?.querySelector(".npc-build-loading-overlay")?.remove();

        const html = this.element;
        const form = html.querySelector("form");
        if (!form) return;

        // Page navigation buttons
        html.querySelectorAll('.page').forEach(el => el.addEventListener('click', event => {
            event.preventDefault();
            if (el.disabled) return;
            el.disabled = true;
            this.data.page = parseInt(el.dataset.page ?? this.data.page);
            this.render(true);
        }));

        html.querySelectorAll('.next-page').forEach(el => el.addEventListener('click', event => {
            event.preventDefault();
            this.data.page = parseInt(form.dataset.page || "0") + 1;
            this.render(true);
        }));

        // Skill/stat increment/decrement buttons
        html.querySelectorAll('.button-set[data-path][data-value][data-dtype="Number"]').forEach(el => el.addEventListener('click', event => {
            event.preventDefault();
            this.data.setProperty(el.dataset.path, parseInt(el.dataset.value));
            this.render(true);
        }));

        // Tagify inputs
        for (const multiselect of html.querySelectorAll('.ptu-tagify[data-filter-name]')) {
            const data = this.data.multiselects[multiselect.dataset.filterName];
            const savePath = multiselect.name;
            const tagifyOptions = {
                enforceWhitelist: true,
                keepInvalidTags: false,
                editTags: false,
                tagTextProp: "label",
                dropdown: {
                    enabled: 0,
                    fuzzySearch: true,
                    mapValueTo: "label",
                    maxItems: data.options.length,
                    searchKeys: ["label"],
                },
                whitelist: data.options,
                maxTags: data.maxTags,
            };

            if (multiselect.matches(".trainer-sex")) {
                tagifyOptions.enforceWhitelist = false;
            }

            if (multiselect.matches(".trainer-features")) {
                tagifyOptions.templates ??= {};
                tagifyOptions.templates.dropdownItem = function (tagData) {
                    return `<div label="${tagData.label}" value="${tagData.value}" uuid="${tagData.uuid}" mappedvalue="${tagData.mappedValue}" class="tagify__dropdown__item ${tagData.label} ${tagData.crossClass ? "crossclass" : ""}" tabindex="0" role="option">${tagData.label}</div>`;
                };
            }

            const tagify = new Tagify(multiselect, tagifyOptions);
            tagify.on("change", event => {
                event.preventDefault();
                const selections = JSON.parse(event.detail.value || "[]");
                const isValid =
                    Array.isArray(selections) &&
                    selections.every(s => typeof s === "object" && typeof s["value"] === "string");
                if (isValid && savePath) {
                    this.data.setProperty(savePath, selections);
                    this.render();
                }
            });
        }

        // Trainer / Pokémon image editor (FilePicker)
        html.querySelectorAll('img[data-edit]').forEach(img => img.addEventListener('click', async event => {
            event.preventDefault();
            const attr = event.currentTarget.dataset.edit;
            const current = foundry.utils.getProperty(this.data, attr);
            const fp = new FilePicker({
                current,
                type: "image",
                redirectToRoot: current ? [current] : [],
                callback: path => {
                    this.data.setProperty(attr, path);
                    this.render(true);
                },
                top: (this.position?.top ?? 0) + 40,
                left: (this.position?.left ?? 0) + 10,
            });
            fp.browse();
        }));

        // Remove Pokémon from party slot
        html.querySelectorAll('.pokemon-remove').forEach(el => el.addEventListener('click', event => {
            event.preventDefault();
            const slot = el.closest(".party-pokemon")?.dataset?.slot;
            this.data.resetPokemonSlot(slot);
            this.render(true);
        }));

        // Randomize a single Pokémon in a party slot
        html.querySelectorAll('.pokemon-randomize').forEach(el => el.addEventListener('click', async event => {
            event.preventDefault();
            const slot = el.closest(".party-pokemon")?.dataset?.slot;
            await this.loading();
            await this.data.randomizePartyPokemon(slot);
            this.render(true);
        }));

        // Habitat / roll-table source selector
        const sourceSelect = html.querySelector("#sourceSelect");
        if (sourceSelect) {
            sourceSelect.addEventListener("change", event => {
                event.preventDefault();
                this.data.sourceSelect.value = sourceSelect.value;
                this.data.sourceSelect.updated = true;
                this.render(true);
            });
        }

        // Feature roll-table source selector
        const featureSourceSelect = html.querySelector("#featureSourceSelect");
        if (featureSourceSelect) {
            featureSourceSelect.addEventListener("change", event => {
                event.preventDefault();
                this.data.featureSourceSelect.value = featureSourceSelect.value;
                this.data.featureSourceSelect.updated = true;
                this.render(true);
            });
        }

        // Edge roll-table source selector
        const edgeSourceSelect = html.querySelector("#edgeSourceSelect");
        if (edgeSourceSelect) {
            edgeSourceSelect.addEventListener("change", event => {
                event.preventDefault();
                this.data.edgeSourceSelect.value = edgeSourceSelect.value;
                this.data.edgeSourceSelect.updated = true;
                this.render(true);
            });
        }

        // Generate / Submit button
        html.querySelectorAll("input.submit[type='button']").forEach(el => el.addEventListener('click', event => {
            event.preventDefault();
            if (this.data.ready) {
                this.loading().then(() => this.close({ properClose: true }));
            }
        }));

        // General form change handler for text, number, select, checkbox, and radio inputs
        form.addEventListener("change", event => {
            const input = event.target;
            if (!input.name) return;
            // Skip tagify inputs and button-set links — each has its own handler above
            if (input.closest('.tagify')) return;
            if (input.matches('.ptu-tagify')) return;
            if (input.closest('.button-set')) return;
            // Skip the habitat source select — handled above
            if (input.id === "sourceSelect") return;
            if (input.id === "featureSourceSelect") return;
            if (input.id === "edgeSourceSelect") return;

            let value;
            if (input.type === "checkbox") value = input.checked;
            else if (input.dataset.dtype === "Number") value = parseFloat(input.value);
            else if (input.type === "number") value = parseInt(input.value);
            else value = input.value;

            this.data.setProperty(input.name, value);
            this.render(true);
        });

        // Allow dropping a character actor to pre-populate trainer data
        html.addEventListener("dragover", event => event.preventDefault());
        html.addEventListener("drop", event => this._onDrop(event));
    }

    async preload() {
        return this.data.preload();
    }

    /**
     * Handle dropping a character actor onto the window to pre-populate trainer data.
     * @param {DragEvent} event
     */
    async _onDrop(event) {
        event.preventDefault();
        let dropData;
        try {
            dropData = JSON.parse(event.dataTransfer?.getData("text/plain") ?? "");
        } catch {
            return;
        }
        if (dropData?.type !== "Actor") return;

        const actor = await fromUuid(dropData.uuid);
        if (!actor || actor.type !== "character") {
            ui.notifications.warn("Only character actors can be dropped here.");
            return;
        }

        await this.loading();
        await this.data.populateFromActor(actor);
        this.render(true);
    }

    /**
     * Shows a loading overlay over the window content while an async operation runs.
     * Uses an overlay rather than replacing the form so AppV2 part tracking is preserved.
     * The overlay is removed automatically when the next _onRender fires.
     */
    async loading() {
        const windowContent = this.element?.querySelector(".window-content");
        if (!windowContent) return;

        // Ensure the container is positioned so the absolute overlay is contained within it
        windowContent.style.position = "relative";

        // Remove any stale overlay
        windowContent.querySelector(".npc-build-loading-overlay")?.remove();

        const overlay = document.createElement("div");
        overlay.classList.add("loading", "npc-build-loading-overlay");
        overlay.style.cssText = "position:absolute;inset:0;z-index:100;background:rgba(0,0,0,0.2);";
        const wheel = document.createElement("div");
        wheel.classList.add("load-wheel");
        overlay.appendChild(wheel);
        windowContent.appendChild(overlay);
    }

    /** @override */
    async close(options = {}) {
        if (options?.properClose && !this.#isGenerating) {
            this.#isGenerating = true;
            try {
                await this.data.finalize();
                await this.data.generate();
            } catch (err) {
                ui.notifications.error("Could not generate the NPC! Check the dev console for more details.");
                Hooks.onError("Application#close", err, {
                    msg: `An error occurred while closing ${this.constructor.name} ${this.appId}`,
                    log: "error",
                    ...options,
                });
                this.#isGenerating = false;
                return;
            }
        }
        return super.close(options);
    }
}