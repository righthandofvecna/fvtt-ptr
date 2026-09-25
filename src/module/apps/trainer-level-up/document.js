const ITEM_DISPLAY_LIMIT = 150;

/**
 * Simplified prerequisite checker against a real actor's items.
 * @param {Object} item - Compendium browser index entry with { prerequisites: [{label, tier}] }
 * @param {Actor} actor
 * @returns {boolean}
 */
function meetsPrereqs(item, actor) {
    if (!item.prerequisites?.length) return true;

    const level = actor.system.level.current;
    const actorItemNames = new Set(
        actor.items.contents.map(i => i.name.toLowerCase())
    );
    const actorItemSlugs = new Set(
        actor.items.contents.map(i => i.system?.slug?.toLowerCase()).filter(Boolean)
    );

    for (const prereq of item.prerequisites) {
        const label = prereq.label?.toLowerCase()?.trim() ?? '';
        if (!label) continue;

        // Level requirement
        const levelMatch = label.match(/^level\s+(\d+)$/i);
        if (levelMatch) {
            if (level < parseInt(levelMatch[1])) return false;
            continue;
        }

        // GM Permission is always met
        if (label === 'gm permission') continue;

        // Check if actor already has an item with this name or slug
        if (actorItemNames.has(label) || actorItemSlugs.has(label)) continue;

        return false;
    }

    return true;
}

export class TrainerLevelUpData {
    constructor(actor) {
        this.actor = actor;
        this._allFeatures = [];
        this._allEdges = [];
        this._resolvedUuids = {}; // cache: uuid -> item name
        this.isLoaded = false;

        // Per-list filter text
        this.featureFilter = '';
        this.edgeFilter = '';

        // For bonus items with multiple options: track which option is selected per bonus index
        this.bonusOptionSelections = {};

        // Per-bonus-item filter text: { [bonusIndex]: string }
        this.bonusFilters = {};
    }

    // ─── Computed getters ─────────────────────────────────────────────────────

    get level() {
        return this.actor.system.level.current;
    }

    get progression() {
        const advancement = game.settings.get("ptu", "variant.trainerAdvancement");
        return CONFIG.PTU.data.trainerProgressions[advancement]
            ?? CONFIG.PTU.data.trainerProgressions["ptr-update"];
    }

    get tier() {
        return this.actor.trainerTier ?? "";
    }

    get unspentStatPoints() {
        return this.actor.system.levelUpPoints ?? 0;
    }

    get unspentFeatureSlots() {
        return Math.max(0, (this.actor.system.feats?.max ?? 0) - (this.actor.system.feats?.total ?? 0));
    }

    get unspentEdgeSlots() {
        return Math.max(0, (this.actor.system.edges?.max ?? 0) - (this.actor.system.edges?.total ?? 0));
    }

    get stats() {
        const statKeys = CONFIG.PTU.data.stats.keys;
        return statKeys.map(key => ({
            key,
            labelKey: `PTU.Stats.${key}`,
            levelUp: this.actor.system.stats[key]?.levelUp ?? 0,
            total: this.actor.system.stats[key]?.total ?? 0,
        }));
    }

    // ─── Bonus items ──────────────────────────────────────────────────────────

    get pendingBonusItems() {
        const entries = this.progression.bonusItems ?? [];
        return entries
            .map((entry, index) => {
                if (entry.level > this.level) return null;
                if (this._isBonusItemFullyClaimed(index, entry)) return null;
                return { index, ...entry };
            })
            .filter(Boolean);
    }

    _claimedCountForOption(bonusIndex, optionIndex) {
        return this.actor.items.contents.filter(i => {
            const source = String(i.flags?.ptu?.bonusItemSource ?? '');
            // Matches "3.1" exactly (single option entry) or "3.1.X" for sub-entries
            return source === `${bonusIndex}.${optionIndex}` || source.startsWith(`${bonusIndex}.${optionIndex}.`);
        }).length;
    }

    _claimedCountSingleOption(bonusIndex) {
        return this.actor.items.contents.filter(i => {
            const source = String(i.flags?.ptu?.bonusItemSource ?? '');
            return source === `${bonusIndex}` || source === `${bonusIndex}.0`;
        }).length;
    }

    _isBonusItemFullyClaimed(index, entry) {
        if (entry.options.length === 1) {
            const needed = entry.options[0].count ?? 1;
            return this._claimedCountSingleOption(index) >= needed;
        }
        // Multi-option: any option fully claimed is sufficient
        for (let optIdx = 0; optIdx < entry.options.length; optIdx++) {
            const needed = entry.options[optIdx].count ?? 1;
            if (this._claimedCountForOption(index, optIdx) >= needed) return true;
        }
        return false;
    }

    describeBonusOption(option) {
        const count = option.count ?? 1;
        const typeName = option.itemType === "feature"
            ? (count > 1 ? "Features" : "Feature")
            : (count > 1 ? "Edges" : "Edge");
        const suffix = option.skipPrereqs ? " ★" : "";

        if (option.uuids?.length) {
            const name = option.uuids
                .map(uuid => this._resolvedUuids[uuid] ?? uuid.split('.').pop())
                .join(', ');
            return `${name}${suffix}`;
        }
        if (option.keywords?.length) {
            return `${count > 1 ? count + " " : ""}${option.keywords.join("/")} ${typeName}${suffix}`;
        }
        return `${count > 1 ? count + " " : ""}Any ${typeName}${suffix}`;
    }

    // ─── Data loading ─────────────────────────────────────────────────────────

    async load() {
        const cb = game.ptu.compendiumBrowser;
        if (!cb.tabs.feats.isInitialized) await cb.tabs.feats.init();
        if (!cb.tabs.edges.isInitialized) await cb.tabs.edges.init();

        const ownedSlugs = new Set(
            this.actor.items.contents
                .filter(i => ['feat', 'edge'].includes(i.type))
                .map(i => i.system?.slug?.toLowerCase())
                .filter(Boolean)
        );

        this._allFeatures = (cb.tabs.feats.indexData ?? [])
            .filter(f => !ownedSlugs.has(f.slug?.toLowerCase()));

        this._allEdges = (cb.tabs.edges.indexData ?? [])
            .filter(e => !ownedSlugs.has(e.slug?.toLowerCase()));

        // Resolve UUIDs for bonus items that reference specific items
        const uuidsToResolve = [];
        for (const entry of (this.progression.bonusItems ?? [])) {
            for (const opt of entry.options) {
                for (const uuid of (opt.uuids ?? [])) {
                    if (!this._resolvedUuids[uuid]) uuidsToResolve.push(uuid);
                }
            }
        }
        await Promise.all(uuidsToResolve.map(async uuid => {
            try {
                const item = await fromUuid(uuid);
                if (item) this._resolvedUuids[uuid] = item.name;
            } catch {}
        }));

        this.isLoaded = true;
    }

    // ─── Item lists ───────────────────────────────────────────────────────────

    getAvailableFeatures(filterText = '') {
        const text = filterText.toLowerCase().trim();
        return this._allFeatures
            .filter(f => meetsPrereqs(f, this.actor))
            .filter(f => !text || f.name.toLowerCase().includes(text))
            .slice(0, ITEM_DISPLAY_LIMIT);
    }

    getAvailableEdges(filterText = '') {
        const text = filterText.toLowerCase().trim();
        return this._allEdges
            .filter(e => meetsPrereqs(e, this.actor))
            .filter(e => !text || e.name.toLowerCase().includes(text))
            .slice(0, ITEM_DISPLAY_LIMIT);
    }

    getBonusOptionItems(option, filterText = '') {
        const text = filterText.toLowerCase().trim();
        const source = option.itemType === "feature" ? this._allFeatures : this._allEdges;

        // UUID-restricted options don't use a list
        if (option.uuids?.length) return [];

        return source
            .filter(item => {
                if (option.keywords?.length) {
                    return option.keywords.some(kw =>
                        item.keywords?.some(ik => ik.toLowerCase() === kw.toLowerCase())
                    );
                }
                return true;
            })
            .filter(item => option.skipPrereqs || meetsPrereqs(item, this.actor))
            .filter(item => !text || item.name.toLowerCase().includes(text))
            .slice(0, ITEM_DISPLAY_LIMIT);
    }

    // ─── Mutations ────────────────────────────────────────────────────────────

    async incrementStat(statKey) {
        if (this.unspentStatPoints <= 0) return;
        const current = this.actor.system.stats[statKey]?.levelUp ?? 0;
        await this.actor.update({ [`system.stats.${statKey}.levelUp`]: current + 1 });
    }

    async decrementStat(statKey) {
        const current = this.actor.system.stats[statKey]?.levelUp ?? 0;
        if (current <= 0) return;
        await this.actor.update({ [`system.stats.${statKey}.levelUp`]: current - 1 });
    }

    async addRegularItem(uuid) {
        const item = await fromUuid(uuid);
        if (!item) return;
        await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
    }

    async claimBonusItem(uuid, bonusIndex, optionIndex) {
        const item = await fromUuid(uuid);
        if (!item) return;
        const itemData = item.toObject();
        const flagValue = optionIndex !== undefined
            ? `${bonusIndex}.${optionIndex}`
            : `${bonusIndex}`;
        foundry.utils.setProperty(itemData, 'flags.ptu.bonusItemSource', flagValue);
        // Mark as free so it doesn't count toward the regular feat/edge total
        itemData.system.free = true;
        await this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    async claimBonusItemByUuid(bonusIndex, optionIndex) {
        const entry = (this.progression.bonusItems ?? [])[bonusIndex];
        if (!entry) return;
        const option = entry.options[optionIndex ?? 0];
        if (!option?.uuids?.length) return;
        for (const uuid of option.uuids) {
            await this.claimBonusItem(uuid, bonusIndex, optionIndex ?? 0);
        }
    }
}
