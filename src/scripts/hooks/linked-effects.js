/**
 * Cascade-deletes all items that share a `flags.ptu.linkedGroup` ID when any
 * member of the group is deleted.  Only the GM client performs the cascade so
 * that each linked item is removed exactly once regardless of how many clients
 * are connected.
 */

/** Tracks groups whose cascade is already in progress to prevent re-entry. */
const _cascadingLinkedGroups = new Set();

export const LinkedEffects = {
    listen() {
        Hooks.on("deleteItem", (item) => {
            // Only the GM performs cascades so every linked item is deleted
            // exactly once even across multiple connected clients.
            if (!game.user.isGM) return;

            const groupId = foundry.utils.getProperty(item, "flags.ptu.linkedGroup");
            if (!groupId) return;

            // Guard against re-entrant cascades triggered by the deletions below.
            if (_cascadingLinkedGroups.has(groupId)) return;
            _cascadingLinkedGroups.add(groupId);

            (async () => {
                try {
                    for (const actor of game.actors) {
                        const toDelete = actor.items
                            .filter(i => foundry.utils.getProperty(i, "flags.ptu.linkedGroup") === groupId)
                            .map(i => i.id);
                        if (toDelete.length > 0) {
                            await actor.deleteEmbeddedDocuments("Item", toDelete);
                        }
                    }
                } finally {
                    _cascadingLinkedGroups.delete(groupId);
                }
            })();
        });
    }
};
