import { getActiveContentSetKeys, buildHiddenSlugs, isHiddenByContentSet } from "../../util/content-sets.js";

export const QuickInsertCompat = {
  listen() {
    Hooks.on("QuickInsert:IndexCompleted", async (quickInsert) => {
      if (!game.modules.get("quick-insert")?.active) return;

      // All indexed results, filtered to PTU compendium items only
      const allResults = quickInsert.search("", null, Number.MAX_SAFE_INTEGER);
      const ptuResults = allResults.filter(r => r.item.package?.startsWith("ptu."));
      if (ptuResults.length === 0) return;

      // Ensure the fields we need are in the pack index cache.
      // pack.getIndex merges into the existing index so repeated calls are safe.
      const packIds = new Set(ptuResults.map(r => r.item.package).filter(Boolean));
      for (const packId of packIds) {
        const pack = game.packs.get(packId);
        if (pack) await pack.getIndex({ fields: ["system.slug", "system.contentSet", "system.replacesSlug"] });
      }

      if (game.settings.get("ptu", "contentSetsEnabled")) {
        const activeSetKeys = getActiveContentSetKeys();

        // split the PTU results by their pack
        const entryDataByPack = ptuResults.reduce((acc, result) => {
          const packId = result.item.package;
          if (!acc[packId]) acc[packId] = [];
          const sys = game.packs.get(result.item.package)?.index.get(result.item.id)?.system ?? {};
          acc[packId].push({ slug: sys.slug, contentSet: sys.contentSet, replacesSlug: sys.replacesSlug });
          return acc;
        }, {});
        const hiddenSlugsByPack = Object.fromEntries(
          Object.entries(entryDataByPack).map(([packId, entryData]) => [packId, buildHiddenSlugs(activeSetKeys, entryData)])
        );

        // Remove items that should be hidden from the quick-insert index
        for (const result of ptuResults) {
          const sys = game.packs.get(result.item.package)?.index.get(result.item.id)?.system ?? {};
          if (isHiddenByContentSet(sys.slug, sys.contentSet, hiddenSlugsByPack[result.item.package], activeSetKeys)) {
            quickInsert.searchLib.removeItem(result.item.uuid);
          }
        }
      } else {
        // When not filtering, inject short labels so duplicate content-set versions are distinguishable
        for (const result of ptuResults) {
          const sys = game.packs.get(result.item.package)?.index.get(result.item.id)?.system ?? {};
          const shortKey = sys.contentSet && CONFIG.PTU.contentSets[sys.contentSet]?.short;
          if (shortKey) {
            result.item.name = `${result.item.name} ${game.i18n.localize(shortKey)}`;
          }
        }
      }
    });
  }
};

