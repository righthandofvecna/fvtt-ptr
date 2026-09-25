import { TrainerLevelUpData } from "./document.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class PTUTrainerLevelUpSheet extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        classes: ["ptu", "trainer-level-up"],
        position: {
            width: 680,
            height: 600,
        },
        window: {
            minimizable: true,
            resizable: true,
        },
        actions: {},
    };

    static PARTS = {
        content: {
            template: "systems/ptu/static/templates/apps/trainer-level-up-sheet.hbs",
            scrollable: [".trainer-level-up-scroll"],
        },
    };

    #data;
    #loadPromise = null;

    constructor(actor, options = {}) {
        super(options);
        this.#data = new TrainerLevelUpData(actor);
    }

    get title() {
        return `Level Up: ${this.#data.actor.name}`;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const data = this.#data;

        // Build bonus item context with option lists resolved
        const pendingBonusItems = data.pendingBonusItems.map(entry => {
            let selectedOptionIdx = data.bonusOptionSelections[entry.index] ?? 0;
            const filterText = data.bonusFilters[entry.index] ?? '';

            // For multi-option entries: if the actor already has items claimed for one
            // option, lock to that option (can't switch without removing those items)
            let isLocked = false;
            if (entry.options.length > 1) {
                for (let optIdx = 0; optIdx < entry.options.length; optIdx++) {
                    if (data._claimedCountForOption(entry.index, optIdx) > 0) {
                        isLocked = true;
                        selectedOptionIdx = optIdx; // force selection to claimed option
                        break;
                    }
                }
            }

            const optionDescriptions = entry.options.map((opt, i) => {
                const claimedCount = entry.options.length === 1
                    ? data._claimedCountSingleOption(entry.index)
                    : data._claimedCountForOption(entry.index, i);
                const needed = (opt.count ?? 1) - claimedCount;
                return {
                    idx: i,
                    label: data.describeBonusOption(opt),
                    isSelected: i === selectedOptionIdx,
                    isDisabled: isLocked && i !== selectedOptionIdx,
                    isUuidOnly: !!(opt.uuids?.length),
                    uuids: (opt.uuids ?? []).map(uuid => ({
                        uuid,
                        name: data._resolvedUuids[uuid] ?? "Unknown Item",
                    })),
                    count: opt.count ?? 1,
                    claimedCount,
                    needed: Math.max(0, needed),
                    done: needed <= 0,
                };
            });

            const selectedOpt = optionDescriptions[selectedOptionIdx];

            return {
                index: entry.index,
                level: entry.level,
                isMultiOption: entry.options.length > 1,
                isLocked,
                selectedOptionIdx,
                optionDescriptions,
                selectedOptionData: selectedOpt,
                filterText,
                items: data.isLoaded && selectedOpt && !selectedOpt.isUuidOnly
                    ? data.getBonusOptionItems(entry.options[selectedOptionIdx], filterText)
                    : [],
            };
        });

        return {
            ...context,
            isLoading: !data.isLoaded,
            level: data.level,
            tier: data.tier,
            unspentStatPoints: data.unspentStatPoints,
            unspentFeatureSlots: data.unspentFeatureSlots,
            unspentEdgeSlots: data.unspentEdgeSlots,
            stats: data.stats,
            availableFeatures: data.isLoaded ? data.getAvailableFeatures(data.featureFilter) : [],
            availableEdges: data.isLoaded ? data.getAvailableEdges(data.edgeFilter) : [],
            featureFilter: data.featureFilter,
            edgeFilter: data.edgeFilter,
            skills: data.isLoaded ? data.getSkillRankUpData() : [],
            showSkillSection: data.isLoaded && data.hasSkillEdges && data.unspentEdgeSlots > 0,
            pendingBonusItems,
            hasAnything: data.unspentStatPoints > 0
                || data.unspentFeatureSlots > 0
                || data.unspentEdgeSlots > 0
                || pendingBonusItems.length > 0,
        };
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        this._startLoad();
    }

    _startLoad() {
        if (this.#loadPromise) return;
        this.#loadPromise = this.#data.load().then(() => {
            this.#loadPromise = null;
            this.render(true);
        }).catch(err => {
            this.#loadPromise = null;
            console.error("TrainerLevelUp | Failed to load compendium data", err);
        });
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;

        // ── Stat distribution ─────────────────────────────────────────────────
        html.querySelectorAll('.stat-increment').forEach(btn => {
            btn.addEventListener('click', async ev => {
                ev.preventDefault();
                btn.disabled = true;
                await this.#data.incrementStat(btn.dataset.stat);
                this.render(true);
            });
        });

        html.querySelectorAll('.stat-decrement').forEach(btn => {
            btn.addEventListener('click', async ev => {
                ev.preventDefault();
                btn.disabled = true;
                await this.#data.decrementStat(btn.dataset.stat);
                this.render(true);
            });
        });

        // ── Regular feature/edge lists ────────────────────────────────────────
        // Filter client-side without re-rendering (fast)
        const featureSearch = html.querySelector('.feature-search');
        if (featureSearch) {
            featureSearch.addEventListener('input', ev => {
                const text = ev.target.value.toLowerCase();
                html.querySelectorAll('.feature-item').forEach(el => {
                    el.hidden = !!text && !el.dataset.name.toLowerCase().includes(text);
                });
            });
        }

        const edgeSearch = html.querySelector('.edge-search');
        if (edgeSearch) {
            edgeSearch.addEventListener('input', ev => {
                const text = ev.target.value.toLowerCase();
                html.querySelectorAll('.edge-item').forEach(el => {
                    el.hidden = !!text && !el.dataset.name.toLowerCase().includes(text);
                });
            });
        }

        // Add regular items
        html.querySelectorAll('.add-regular-item').forEach(btn => {
            btn.addEventListener('click', async ev => {
                ev.preventDefault();
                btn.disabled = true;
                await this.#data.addRegularItem(btn.dataset.uuid);
                this.render(true);
            });
        });

        // Rank up a skill
        html.querySelectorAll('.rank-up-skill').forEach(btn => {
            btn.addEventListener('click', async ev => {
                ev.preventDefault();
                btn.disabled = true;
                await this.#data.rankUpSkill(btn.dataset.skill, btn.dataset.uuid);
                this.render(true);
            });
        });

        // ── Bonus item option selection ───────────────────────────────────────
        html.querySelectorAll('.bonus-option-radio').forEach(radio => {
            radio.addEventListener('change', ev => {
                const bonusIdx = parseInt(radio.dataset.bonusIndex);
                this.#data.bonusOptionSelections[bonusIdx] = parseInt(radio.value);
                this.render(true);
            });
        });

        // Bonus item list filtering (client-side)
        html.querySelectorAll('.bonus-item-search').forEach(input => {
            input.addEventListener('input', ev => {
                const text = ev.target.value.toLowerCase();
                const bonusIdx = input.dataset.bonusIndex;
                html.querySelectorAll(`.bonus-item-list-item[data-bonus-index="${bonusIdx}"]`).forEach(el => {
                    el.hidden = !!text && !el.dataset.name.toLowerCase().includes(text);
                });
            });
        });

        // Claim bonus item from list
        html.querySelectorAll('.claim-bonus-item').forEach(btn => {
            btn.addEventListener('click', async ev => {
                ev.preventDefault();
                btn.disabled = true;
                const { uuid, bonusIndex, optionIndex } = btn.dataset;
                await this.#data.claimBonusItem(
                    uuid,
                    parseInt(bonusIndex),
                    optionIndex !== undefined ? parseInt(optionIndex) : undefined
                );
                this.render(true);
            });
        });

        // Claim a UUID-only bonus item directly
        html.querySelectorAll('.claim-bonus-uuid').forEach(btn => {
            btn.addEventListener('click', async ev => {
                ev.preventDefault();
                btn.disabled = true;
                const { uuid, bonusIndex, optionIndex } = btn.dataset;
                await this.#data.claimBonusItem(
                    uuid,
                    parseInt(bonusIndex),
                    optionIndex !== undefined ? parseInt(optionIndex) : undefined
                );
                this.render(true);
            });
        });
    }
}
