/**
 * Returns the keys of content sets that are both defined in CONFIG and enabled in settings.
 * Returns an empty array when content sets are disabled entirely.
 * @returns {string[]}
 */
export function getActiveContentSetKeys() {
  if (!game.settings.get("ptu", "contentSetsEnabled")) return [];
  const enabledContentSets = game.settings.get("ptu", "enabledContentSets");
  const contentSetsConfig = CONFIG.PTU.contentSets;
  return Object.keys(contentSetsConfig).filter(k => enabledContentSets[k]).sort((a,b)=>contentSetsConfig[a].priority - contentSetsConfig[b].priority);
}

/**
 * Builds the set of slugs that should be hidden given a list of active set keys.
 * Hidden slugs come from two sources:
 *  1. `replacesSlug` on every item belonging to an active content set.
 *  2. Static `removals` arrays declared on each active content set config.
 *
 * @param {string[]} activeSetKeys
 * @param {Array<{slug:string, contentSet?: string, replacesSlug?: string}>} entries
 * @returns {Set<string>}
 */
export function buildHiddenSlugs(activeSetKeys, entries) {
  const contentSetsConfig = CONFIG.PTU.contentSets;
  const hiddenSlugs = new Set();
  const kReplacedByV = {};

  for (const key of activeSetKeys) {
    for (const entry of entries) {
      if (entry.contentSet === key && entry.replacesSlug) {
        hiddenSlugs.add(entry.replacesSlug);
        if (kReplacedByV[entry.replacesSlug]) {
          hiddenSlugs.add(kReplacedByV[entry.replacesSlug]);
        }
        kReplacedByV[entry.replacesSlug] = entry.slug;
      }
    }

    for (const slug of (contentSetsConfig[key].removals ?? [])) {
      hiddenSlugs.add(slug);
    }
  }

  return hiddenSlugs;
}

/**
 * Returns true if the given entry should be hidden based on content set filtering.
 * @param {string} slug
 * @param {string} contentSet
 * @param {Set<string>} hiddenSlugs
 * @param {string[]} activeSetKeys
 * @returns {boolean}
 */
export function isHiddenByContentSet(slug, contentSet, hiddenSlugs, activeSetKeys) {
  return hiddenSlugs.has(slug) || (!!contentSet && !activeSetKeys.includes(contentSet));
}
