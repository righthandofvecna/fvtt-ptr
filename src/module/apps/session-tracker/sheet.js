import { PTUSessionTracker } from "./tracker.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class PTUSessionEndApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "ptu-session-end",
        classes: ["ptu", "session-end"],
        position: { width: 600, height: "auto" },
        window: {
            title: "PTU.SessionEnd.Title",
            minimizable: true,
            resizable: true,
        },
        actions: {
            addPokemon: PTUSessionEndApp.#addPokemon,
            submitAwards: PTUSessionEndApp.#submitAwards,
        },
    };

    static PARTS = {
        content: {
            template: "systems/ptu/static/templates/apps/session-end-sheet.hbs",
        },
    };

    constructor(options = {}) {
        super(options);
        /** @type {Set<string>} Extra actor IDs added manually by the GM */
        this._extraPokemon = new Set();
        /** @type {Map<string, number>} Persisted award values across re-renders */
        this._awardValues = new Map();
    }

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        // All tracked IDs (session + manually added)
        const trackedIds = new Set([
            ...PTUSessionTracker.getTrackedIds(),
            ...this._extraPokemon,
        ]);

        // Build per-trainer sections
        const playerChars = game.users
            .filter(u => u.character && !u.isGM)
            .map(u => ({ user: u, character: u.character }));

        const trainerSections = playerChars.map(({ user, character }) => {
            // Find Pokemon belonging to this trainer
            const ownedPokemon = game.actors.filter(a =>
                a.type === "pokemon" &&
                a.flags?.ptu?.party?.trainer === character.id
            );

            const interacted = ownedPokemon.filter(p => trackedIds.has(p.id));

            const pokemon = interacted.map(p => {
                const lowestFriendship = PTUSessionTracker.effectiveLowestFriendship(p);
                const currentFriendship = p.system.friendship ?? 0;
                const currentFP = p.flags?.ptu?.friendshipPoints ?? 0;
                const costToNext = PTUSessionTracker.getCostForNextLevel(currentFriendship, lowestFriendship);
                return {
                    id: p.id,
                    name: p.name,
                    img: p.img,
                    currentFriendship,
                    lowestFriendship,
                    currentFP,
                    costToNext: isFinite(costToNext) ? costToNext : null,
                    isMaxFriendship: currentFriendship >= 5,
                    starsDisplay: Array.from({ length: 5 }, (_, i) => i < currentFriendship ? "filled" : "empty"),
                };
            });

            return {
                userId: user.id,
                userName: user.name,
                characterId: character.id,
                characterName: character.name,
                characterImg: character.img,
                pokemon,
            };
        });

        // Build the list of all player-owned Pokemon not yet tracked, for the "add" picker
        const allTrackedIds = trackedIds;

        // Build a map of trainerId → character name for label formatting
        const trainerNames = new Map(playerChars.map(({ character }) => [character.id, character.name]));

        const addablePokemon = game.actors
            .filter(a =>
                a.type === "pokemon" &&
                a.hasPlayerOwner &&
                !allTrackedIds.has(a.id)
            )
            .map(a => {
                const trainerId = a.flags?.ptu?.party?.trainer;
                const trainerName = trainerId ? trainerNames.get(trainerId) : null;
                const label = trainerName ? `${trainerName}'s ${a.name}` : a.name;
                return { label, value: a.id, uuid: a.uuid };
            })
            .sort((a, b) => a.label.localeCompare(b.label));

        return {
            ...context,
            trainers: trainerSections,
            addablePokemon,
        };
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;

        // +/− stepper buttons for award inputs
        html.querySelectorAll(".award-stepper").forEach(stepper => {
            const actorId = stepper.dataset.actorId;
            const display = stepper.querySelector(".fp-award-display");
            const hidden = stepper.querySelector(".fp-award");

            const update = (delta) => {
                const current = parseInt(hidden.value) || 0;
                const next = current + delta; // allow negative (deduct FP)
                hidden.value = next;
                display.textContent = next;
                this._awardValues.set(actorId, next);
                this.#updateTotals();
            };

            // Restore persisted value to display
            if (actorId && this._awardValues.has(actorId)) {
                const v = this._awardValues.get(actorId);
                hidden.value = v;
                display.textContent = v;
            }

            stepper.querySelector(".fp-decrement")?.addEventListener("click", () => update(-1));
            stepper.querySelector(".fp-increment")?.addEventListener("click", () => update(+1));
        });

        // Live total counter per trainer (call once on render to show restored values)
        this.#updateTotals();

        // Tagify for adding extra Pokemon
        const addInput = html.querySelector("input[name='add-pokemon']");
        if (addInput && window.Tagify) {
            const tagify = new Tagify(addInput, {
                enforceWhitelist: true,
                keepInvalidTags: false,
                editTags: false,
                tagTextProp: "label",
                dropdown: {
                    enabled: 0,
                    fuzzySearch: true,
                    mapValueTo: "label",
                    maxItems: context.addablePokemon.length,
                    searchKeys: ["label"],
                },
                whitelist: context.addablePokemon,
            });

            tagify.on("add", event => {
                const actorId = event.detail.data.value;
                this._extraPokemon.add(actorId);
                this.render(true);
            });
        }
    }

    #updateTotals() {
        const html = this.element;
        html.querySelectorAll(".trainer-section").forEach(section => {
            let total = 0;
            section.querySelectorAll(".award-stepper").forEach(stepper => {
                const actorId = stepper.dataset.actorId;
                const pts = this._awardValues.get(actorId) ?? 0;
                total += pts;

                // Per-Pokémon: warn if a single Pokémon gets > 2 FP
                const perWarn = stepper.querySelector(".per-award-warning");
                if (perWarn) perWarn.style.opacity = pts > 2 ? '1' : '0';
            });
            const totalEl = section.querySelector(".award-summary .count");
            if (totalEl) totalEl.textContent = total;

            const warningEl = section.querySelector(".award-warning");
            if (warningEl) warningEl.style.opacity = total > 3 ? '1' : '0';
        });
    }

    // ─── Actions ──────────────────────────────────────────────────────────────

    static async #addPokemon() {
        // Handled via Tagify — this action is a fallback no-op
    }

    static async #submitAwards() {
        // Collect award values from the persisted map (source of truth)
        const awards = {};
        for (const [actorId, pts] of this._awardValues.entries()) {
            if (pts !== 0) awards[actorId] = pts;
        }

        // Apply points to each Pokémon
        const updates = Object.entries(awards).map(([actorId, pts]) => {
            const actor = game.actors.get(actorId);
            if (!actor) return Promise.resolve();
            return PTUSessionTracker.awardPoints(actor, pts);
        });

        await Promise.all(updates);

        // Clear the session tracking, then immediately re-populate with any
        // Pokémon currently placed on the active scene — done as a single write
        // to avoid the async race between clear() and multiple record() calls.
        const activeScene = game.scenes?.active;
        const sceneActorIds = [];
        if (activeScene) {
            for (const tokenDoc of activeScene.tokens) {
                const actor = tokenDoc.actor;
                if (actor && actor.type === "pokemon" && actor.hasPlayerOwner
                        && !sceneActorIds.includes(actor.id)) {
                    sceneActorIds.push(actor.id);
                }
            }
        }
        await game.settings.set("ptu", PTUSessionTracker.SETTING, sceneActorIds);

        if (game.settings.get("ptu", "variant.useSessionBasedRecovery")) {
            const updates = [];
            for (const actor of game.actors.values()) {
                updates.push(actor.onDayEnd());
            }
            await Promise.allSettled(updates);
        }

        ui.notifications.info(game.i18n.localize("PTU.SessionEnd.Submitted"));
        this.close();
    }
}
