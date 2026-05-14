import { getActiveContentSetKeys, buildHiddenSlugs, isHiddenByContentSet } from "../../util/content-sets.js";

export const QuickInsertCompat = {
  listen() {
    Hooks.on("QuickInsert:IndexCompleted", async (quickInsert) => {
      if (!game.modules.get("quick-insert")?.active) return;
      if (!game.settings.get("ptu", "contentSetsEnabled")) return;

      const activeSetKeys = getActiveContentSetKeys();

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

      // Build hidden slugs from the index entries of all PTU results
      const entryData = ptuResults.map(result => {
        const sys = game.packs.get(result.item.package)?.index.get(result.item.id)?.system ?? {};
        return { slug: sys.slug, contentSet: sys.contentSet, replacesSlug: sys.replacesSlug };
      });
      const hiddenSlugs = buildHiddenSlugs(activeSetKeys, entryData);

      // Remove items that should be hidden from the quick-insert index
      for (const result of ptuResults) {
        const sys = game.packs.get(result.item.package)?.index.get(result.item.id)?.system ?? {};
        if (isHiddenByContentSet(sys.slug, sys.contentSet, hiddenSlugs, activeSetKeys)) {
          quickInsert.searchLib.removeItem(result.item.uuid);
        }
      }
    });
  }
};
