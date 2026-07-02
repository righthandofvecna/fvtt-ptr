import { sluggify } from "../../util/misc.js";

function addPageToCache(page) {
  const key = sluggify(page.name);
  const existing = CONFIG.PTU.keywordPages.get(key);
  if (!existing) {
    CONFIG.PTU.keywordPages.set(key, [page]);
  } else {
    const idx = existing.findIndex(p => p._id === page._id);
    if (idx >= 0) existing[idx] = page;
    else existing.push(page);
  }
}

function removePageFromCache(page) {
  const key = sluggify(page.name);
  const existing = CONFIG.PTU.keywordPages.get(key);
  if (!existing) return;
  const filtered = existing.filter(p => p._id !== page._id);
  if (filtered.length) CONFIG.PTU.keywordPages.set(key, filtered);
  else CONFIG.PTU.keywordPages.delete(key);
}

export const Keywords = {
  listen: async () => {
    Hooks.on("ready", async () => {
      const keywordJournal = await fromUuid("Compendium.ptu.journals.JournalEntry.keywordsReferenc");
      if (keywordJournal) {
        CONFIG.PTU.keywordPages = new Map();
        for (const page of keywordJournal.pages.contents) {
          addPageToCache(page);
        }
        // Re-prepare all actors so items pick up keyword effects and rules
        for (const actor of game.actors.values()) {
          actor.reset();
        }
        // Also re-prepare synthetic actors (unlinked tokens on the active scene)
        for (const token of canvas.tokens?.placeables ?? []) {
          if (!token.actor?.isToken) continue;
          token.actor.reset();
        }
      }
    });

    // Keep the keyword pages cache in sync when keyword pages are created/updated/deleted
    Hooks.on("createJournalEntryPage", (page) => {
      if (!CONFIG.PTU.keywordPages) return;
      addPageToCache(page);
    });

    Hooks.on("updateJournalEntryPage", (page) => {
      if (!CONFIG.PTU.keywordPages) return;
      addPageToCache(page);
    });

    Hooks.on("deleteJournalEntryPage", (page) => {
      if (!CONFIG.PTU.keywordPages) return;
      removePageFromCache(page);
    });
  }
};