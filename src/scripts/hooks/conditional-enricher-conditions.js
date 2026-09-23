/**
 * Mapping of condition names to functions that return true/false.
 * These are used by the <div data-if="..."> enricher.
 * Add new conditions here as needed.
 */
export const CONDITIONS = {
    friendshipSpiritEnabled: () => game.settings.get("ptu", "variant.spiritPlaytest") ?? false,
    ppVariantEnabled: () => game.settings.get("ptu", "variant.usePP") ?? false,
    ptrTrackEnabled: () => game.settings.get("ptu", "variant.trainerAdvancement") === "ptr-update",
    longTrackEnabled: () => game.settings.get("ptu", "variant.trainerAdvancement") === "long-track",
    shortTrackEnabled: () => game.settings.get("ptu", "variant.trainerAdvancement") === "short-track",
    originalTrackEnabled: () => ["original", "data-revamp"].includes(game.settings.get("ptu", "variant.trainerAdvancement")),
    contestRulesEnabled: () => game.settings.get("ptu", "variant.useContestRules") ?? false,
    tutorPointsEnabled: () => game.settings.get("ptu", "variant.useTutorPoints") ?? false,
    dexExpEnabled: () => game.settings.get("ptu", "variant.useDexExp") ?? false,
};
