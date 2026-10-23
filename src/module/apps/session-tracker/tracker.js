/**
 * PTUSessionTracker
 *
 * Manages the world-scoped list of player-owned Pokémon that have been
 * interacted with during the current session, and handles the friendship-point
 * award logic that runs at the end of each session.
 */
export class PTUSessionTracker {
    static SETTING = "session.interactedPokemon";

    /**
     * Base friendship-point costs to advance from each level.
     * Index = current friendship level (0-4).
     * Because "lowest friendship" affects the cost multiplier,
     * the cost for 0->1 friendship and 1->2 friendship is always higher
     * than listed here.
     */
    static BASE_COSTS = [3, 3, 3, 6, 12];

    // ─── Tracking ────────────────────────────────────────────────────────────

    /**
     * Record a Pokémon as interacted with this session.
     * No-ops for non-Pokémon actors, non-player-owned actors, or duplicates.
     * @param {Actor} actor
     */
    static record(actor) {
        if (!actor || actor.type !== "pokemon") return;
        if (!actor.hasPlayerOwner) return;
        if (!game.user.isGM) return; // Only GM maintains the shared list

        const current = game.settings.get("ptu", this.SETTING) ?? [];
        if (current.includes(actor.id)) return;

        game.settings.set("ptu", this.SETTING, [...current, actor.id]);
    }

    /**
     * Returns all currently-tracked Pokémon actor IDs.
     * @returns {string[]}
     */
    static getTrackedIds() {
        return game.settings.get("ptu", this.SETTING) ?? [];
    }

    /**
     * Returns all currently-tracked Pokémon actors (live documents).
     * @returns {Actor[]}
     */
    static getTrackedActors() {
        return this.getTrackedIds()
            .map(id => game.actors.get(id))
            .filter(Boolean);
    }

    /**
     * Clears the tracked list.
     */
    static clear() {
        if (!game.user.isGM) return;
        game.settings.set("ptu", this.SETTING, []);
    }

    // ─── Friendship maths ─────────────────────────────────────────────────────

    /**
     * Returns the FP-cost multiplier based on the lowest friendship the Pokémon
     * has ever had.
     * @param {number} lowestFriendship
     * @returns {number}
     */
    static getCostMultiplier(lowestFriendship) {
        if (lowestFriendship === 0) return 2;
        if (lowestFriendship === 1) return 1.5;
        return 1;
    }

    /**
     * Returns the FP cost to advance from `currentFriendship` to the next level,
     * given the effective lowest-friendship multiplier.
     * Returns Infinity if already at max (5).
     * @param {number} currentFriendship
     * @param {number} lowestFriendship
     * @returns {number}
     */
    static getCostForNextLevel(currentFriendship, lowestFriendship) {
        if (currentFriendship >= 5) return Infinity;
        const base = PTUSessionTracker.BASE_COSTS[currentFriendship] ?? Infinity;
        return Math.ceil(base * this.getCostMultiplier(lowestFriendship));
    }

    /**
     * Computes the effective lowestFriendship that will be stored for a Pokémon
     * when points are awarded.
     * @param {Actor} actor
     * @returns {number}
     */
    static effectiveLowestFriendship(actor) {
        const current = actor.system.friendship ?? 0;
        const stored = actor.flags?.ptu?.lowestFriendship;
        return stored !== undefined ? Math.min(stored, current) : current;
    }

    /**
     * Simulate adding `pointsToAdd` FP to a Pokémon and return the resulting
     * { friendship, remainingFP } without mutating anything.
     *
     * Rules:
     * - Friendship increases by AT MOST one level per award.
     * - On level-up the FP pool resets to 0 (no carryover).
     * - FP cannot go below 0.
     *
     * @param {Actor} actor
     * @param {number} pointsToAdd  May be negative to deduct FP.
     * @returns {{ friendship: number, remainingFP: number }}
     */
    static simulateAward(actor, pointsToAdd) {
        const lowestFriendship = this.effectiveLowestFriendship(actor);
        const currentFP = actor.flags?.ptu?.friendshipPoints ?? 0;
        let fp = currentFP + pointsToAdd;
        let friendship = actor.system.friendship ?? 0;

        if (friendship < 5) {
            const cost = this.getCostForNextLevel(friendship, lowestFriendship);
            if (fp >= cost) {
                // Advance exactly one level; FP resets to 0 (no overflow carry).
                fp = 0;
                friendship = Math.min(5, friendship + 1);
            } else {
                fp = Math.max(0, fp); // clamp — FP cannot be negative
            }
        } else {
            fp = Math.max(0, fp);
        }

        return { friendship, remainingFP: fp };
    }

    /**
     * Apply `pointsToAdd` FP to a Pokémon actor (may be negative to deduct),
     * levelling up friendship as needed, and updating lowestFriendship.
     * @param {Actor} actor
     * @param {number} pointsToAdd
     * @returns {Promise<void>}
     */
    static async awardPoints(actor, pointsToAdd) {
        if (pointsToAdd === 0) return;

        const lowestFriendship = this.effectiveLowestFriendship(actor);
        const { friendship, remainingFP } = this.simulateAward(actor, pointsToAdd);

        await actor.update({
            "system.friendship": friendship,
            "flags.ptu.friendshipPoints": remainingFP,
            "flags.ptu.lowestFriendship": lowestFriendship,
        });
    }
}
