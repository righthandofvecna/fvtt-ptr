export const ContentSetRedirects = {
    listen() {
        Hooks.on("setup", async () => {
            if (!game.settings.get("ptu", "contentSetsEnabled")) return;

            const enabledContentSets = game.settings.get("ptu", "enabledContentSets");
            const contentSetsConfig = CONFIG.PTU.contentSets;

            const activeSetKeys = Object.keys(contentSetsConfig)
                .filter(k => enabledContentSets[k])
                .sort((a, b) => contentSetsConfig[a].priority - contentSetsConfig[b].priority);

            if (activeSetKeys.length === 0) return;

            // Gather all enabled packs for item types
            const browserPackSettings = game.settings.get("ptu", "compendiumBrowserPacks");
            const loadedPackIds = new Set();
            for (const [_tab, packs] of Object.entries(browserPackSettings)) {
                for (const [packId, data] of Object.entries(packs)) {
                    if (data?.load !== false) loadedPackIds.add(packId);
                }
            }

            // Always include built-in PTU packs
            for (const pack of game.packs) {
                if (pack.metadata.packageId === "ptu" && pack.documentName === "Item") {
                    loadedPackIds.add(pack.collection);
                }
            }

            const INDEX_FIELDS = ["system.slug", "system.contentSet", "system.replacesSlug"];

            // Build slug → UUID map for all base PTU items (contentSet = "")
            /** @type {Map<string, string>} slug → uuid */
            const baseSlugToUUID = new Map();

            /** @type {Array<{contentSet: string, replacesSlug: string, uuid: string}>} */
            const overrideItems = [];

            for (const packId of loadedPackIds) {
                const pack = game.packs.get(packId);
                if (!pack || pack.documentName !== "Item") continue;

                let index;
                try {
                    index = await pack.getIndex({ fields: INDEX_FIELDS });
                } catch (err) {
                    console.warn(`PTU | ContentSetRedirects: could not index pack ${packId}`, err);
                    continue;
                }

                for (const entry of index) {
                    const contentSet = entry.system?.contentSet ?? "";
                    const slug = entry.system?.slug ?? "";
                    const replacesSlug = entry.system?.replacesSlug ?? "";
                    const uuid = `Compendium.${pack.collection}.Item.${entry._id}`;

                    if (!contentSet) {
                        // Base PTU item — register its slug → UUID
                        if (slug) baseSlugToUUID.set(slug, uuid);
                    } else if (activeSetKeys.includes(contentSet) && replacesSlug) {
                        overrideItems.push({ contentSet, replacesSlug, uuid });
                    }
                }
            }

            if (baseSlugToUUID.size === 0 || overrideItems.length === 0) return;

            // Register redirects in ascending priority order (lowest first) so that
            // higher-priority sets overwrite lower-priority ones for the same base item.
            overrideItems.sort((a, b) =>
                contentSetsConfig[a.contentSet].priority - contentSetsConfig[b.contentSet].priority
            );

            CONFIG.compendium ??= {};
            CONFIG.compendium.uuidRedirects ??= {};

            for (const { replacesSlug, uuid } of overrideItems) {
                const baseUUID = baseSlugToUUID.get(replacesSlug);
                if (baseUUID) {
                    CONFIG.compendium.uuidRedirects[baseUUID] = uuid;
                }
            }

            console.log(`PTU | ContentSetRedirects: registered ${Object.keys(CONFIG.compendium.uuidRedirects).length} UUID redirect(s).`);
        });
    }
}
