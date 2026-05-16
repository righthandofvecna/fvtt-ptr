/**
 * @file manager.js
 * GithubSyncManager — static utility class containing all business logic for
 * the in-Foundry GitHub commit/PR workflow.
 *
 * Ported from PTR2e's GithubManager (src/module/apps/github.ts) and made
 * fully generic via a GithubSyncConfig object. No system-specific code lives here.
 *
 * Authentication / API protocol:
 *  - Backend endpoint: `{config.apiUrl}/commit`  (POST)
 *  - Identity endpoint: `{config.apiUrl}/identify` (POST)
 *  - If the server returns `{ auth_url }`, a GitHub OAuth popup is opened and
 *    the request is retried once after the popup closes.
 */

const fu = foundry.utils;

class GithubSyncManager {
    /** @type {import("./config.js").GithubSyncConfig|null} */
    static #config = null;

    /**
     * The GithubSyncSheet class, set by index.js after both modules are loaded
     * to avoid a circular import dependency.
     * @type {typeof import("./sheet.js").GithubSyncSheet|null}
     */
    static SheetClass = null;

    /**
     * Warnings from the most recent successful commit, shown in the commit
     * manager sheet after staging. Reset on each new commit attempt.
     * @type {string[]}
     */
    static #lastWarnings = [];

    /** @returns {string[]} */
    static get lastWarnings() {
        return GithubSyncManager.#lastWarnings;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Setup
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Store a resolved config object. Called once during system init.
     * @param {import("./config.js").GithubSyncConfig} config
     */
    static configure(config) {
        GithubSyncManager.#config = config;
    }

    /** @returns {import("./config.js").GithubSyncConfig} */
    static get config() {
        if (!GithubSyncManager.#config) {
            throw new Error("GithubSyncManager: not configured. Call configure() first.");
        }
        return GithubSyncManager.#config;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Document resolution

    /**
     * Returns true if this item is eligible to be committed:
     *  - Its type is in `documentTypes`, AND
     *  - It either lives inside one of the configured packs, or was imported
     *    from one of them (has a matching compendium source UUID).
     *
     * @param {Item} item
     * @returns {boolean}
     */
    static isCommittableItem(item) {
        const { documentTypes } = GithubSyncManager.config;
        const validPacks = new Set(Object.values(documentTypes));

        // Type must be supported
        if (!documentTypes[item.type]) return false;

        // Item is open directly from a compendium
        if (!item.pack) return false;
        
        return validPacks.has(item.pack);

        // World item — check if it was imported from one of the valid packs.
        // Source UUID format: "Compendium.<systemId>.<packName>.Item.<id>"
        // const sourceId =
        //     item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
        // if (sourceId) {
        //     const parts = sourceId.split(".");
        //     if (parts[0] === "Compendium" && parts.length >= 3) {
        //         return validPacks.has(`${parts[1]}.${parts[2]}`);
        //     }
        // }

        // return false;
    }

    /**
     * Returns true if this JournalEntry is eligible to be committed:
     *  - "journal" is configured in `documentTypes`, AND
     *  - The journal lives inside that configured compendium pack.
     *
     * @param {JournalEntry} journal
     * @returns {boolean}
     */
    static isCommittableJournal(journal) {
        const { documentTypes } = GithubSyncManager.config;
        const journalPackId = documentTypes.journal;
        if (!journalPackId) return false;
        if (!journal.pack) return false;
        return journal.pack === journalPackId;
    }
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Find the compendium item that corresponds to a live world item.
     * Tries compendiumSource flags first, then falls back to slug-based matching.
     *
     * @param {Item} item        Live world item
     * @param {CompendiumCollection} pack  The target compendium
     * @returns {Promise<Item|null>}
     */
    static async getExistingItem(item, pack) {
        const { getItemSlug, slugify } = GithubSyncManager.config;

        // First, check if the item is already in the compendium
        if (item.pack) {
            return item;
        }

        // It's not in the compendium, so now try
        const sourceId =
            item.flags?.core?.sourceId ?? item._stats?.compendiumSource;
        if (sourceId) {
            const id = sourceId.split(".").at(-1);
            const found = await pack.getDocument(id);
            if (found) return found;
        }

        const index = await pack.getIndex({ fields: ["system.slug"] });
        const itemSlug = getItemSlug(item.toObject?.() ?? item) ?? slugify(item.name);
        const match = index.find(
            (i) => itemSlug === (getItemSlug(i) ?? slugify(i.name))
        );
        if (match) return pack.getDocument(match._id);

        return null;
    }

    /**
     * Find the compendium journal that corresponds to a live world journal.
     * If already in the pack, returns it directly. Falls back to name matching.
     *
     * @param {JournalEntry} journal
     * @param {CompendiumCollection} pack
     * @returns {Promise<JournalEntry|null>}
     */
    static async getExistingJournal(journal, pack) {
        if (journal.pack) return journal;

        const sourceId = journal.flags?.core?.sourceId ?? journal._stats?.compendiumSource;
        if (sourceId) {
            const id = sourceId.split(".").at(-1);
            const found = await pack.getDocument(id);
            if (found) return found;
        }

        const index = await pack.getIndex();
        const match = index.find((i) => i.name === journal.name);
        if (match) return pack.getDocument(match._id);

        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Diffing & merging
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Compute a clean diff between a live item and its compendium source.
     * Strips universal Foundry metadata noise, then calls `config.diffCleanup`
     * for any system-specific cleanup.
     *
     * @param {object} item      Raw item source (.toObject())
     * @param {object} packItem  Raw pack source
     * @returns {object} Cleaned diff
     */
    static getDiffableItem(item, packItem) {
        const diff = fu.diffObject(packItem, item);

        // Strip universal Foundry metadata noise
        if (diff.flags?.core) {
            delete diff.flags.core;
            if (fu.isEmpty(diff.flags)) delete diff.flags;
        }
        delete diff.sort;
        delete diff._id;
        delete diff._key;
        delete diff._stats;
        delete diff.folder;
        delete diff.ownership;

        if (fu.isEmpty(diff.system)) delete diff.system;

        return GithubSyncManager.config.diffCleanup(diff, packItem);
    }

    /**
     * Merge a diff back onto the pack item to produce the final document state,
     * strip remaining Foundry noise, call `config.mergeCleanup`, then validate.
     *
     * @param {object} diff      Output of getDiffableItem()
     * @param {object} packItem  Raw pack source
     * @returns {object|null}    Merged data, or null if validation fails
     */
    static prepareUpdateData(diff, packItem) {
        const { mergeCleanup } = GithubSyncManager.config;

        let data = fu.mergeObject(packItem, diff, { inplace: false });

        // Explicitly restore every top-level field that must keep its pack/GitHub
        // value and must never be derived from or overwritten by the live world item.
        // We do this explicitly rather than relying on mergeObject carrying them
        // through, because `pack.getDocument().toObject()` may not expose all source
        // fields depending on the Foundry version.
        for (const field of ["_id", "_key", "_stats", "ownership", "folder", "sort"]) {
            if (Object.hasOwn(packItem, field)) data[field] = packItem[field];
            else delete data[field];
        }

        // flags.core.sourceId is a Foundry compendium pointer — not present in
        // GitHub source files and meaningless outside Foundry.
        if (data.flags?.core?.sourceId) delete data.flags.core.sourceId;
        if (fu.isEmpty(data.flags?.core)) delete data.flags?.core;
        if (fu.isEmpty(data.flags)) delete data.flags;

        // System-specific post-merge cleanup (array merging, uuid stripping, etc.)
        data = mergeCleanup(data, diff, packItem);
        if (data === null) return null;

        return data;
    }

    /**
     * Compute a diff between a live journal and its compendium source in a way
     * that is insensitive to page array ordering and ignores `_stats` on both
     * the journal and each of its pages.
     *
     * @param {object} journalData      Raw journal source (.toObject())
     * @param {object} packJournalData  Raw pack source
     * @returns {object} Cleaned diff
     */
    static getDiffableJournal(journalData, packJournalData) {
        /**
         * Produce a normalised copy of a journal for stable diffing:
         *  - Strips journal-level metadata noise.
         *  - Strips _stats and ownership from every page (volatile, auto-updated).
         *  - Sorts pages by _id so order differences are never reported as changes.
         */
        const normalize = (data) => {
            const d = fu.deepClone(data);
            delete d._id;
            delete d._key;
            delete d._stats;
            delete d.sort;
            delete d.folder;
            delete d.ownership;
            if (d.flags?.core) {
                delete d.flags.core;
                if (fu.isEmpty(d.flags)) delete d.flags;
            }
            if (Array.isArray(d.pages)) {
                for (const page of d.pages) {
                    delete page._stats;
                    delete page.ownership;
                }
                d.pages = d.pages.slice().sort((a, b) => (a._id < b._id ? -1 : 1));
            }
            return d;
        };

        const diff = fu.diffObject(normalize(packJournalData), normalize(journalData));
        return GithubSyncManager.config.diffCleanup(diff, packJournalData);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Commit flow
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Thin wrapper so this method can be used as an AppV2 sheet action where
     * `this` is the sheet instance and `this.document` is the item.
     * In AppV1 sheets, call `GithubSyncManager.commitItemToGithub(this.object)` instead.
     */
    static async commitItemToGithubSheet() {
        return GithubSyncManager.commitItemToGithub(this.document);
    }

    /**
     * Main entry point.
     *
     * Pipeline (validate-all-first, then stage-all):
     *  1. Guard checks (isCommittableItem, pack exists, blockedItems).
     *  2. Collect all transitive referenced documents via getReferencedDocuments.
     *  3. Prepare blobs for the primary item AND every dependency upfront
     *     (merge/diff → transform → validateDocument).
     *  4. Aggregate all errors and warnings across every blob.
     *     Unresolvable/non-compendium UUID references become warnings.
     *  5. If ANY errors exist: show them and abort — nothing is staged.
     *  6. Stage all blobs (primary first, dependencies silently).
     *  7. Open the commit manager UI.
     *
     * @param {Item} document  The live Foundry Item to commit
     */

    static async commitItemToGithub(document, button = null) {
        const { blockedItems } = GithubSyncManager.config;

        if (!GithubSyncManager.isCommittableItem(document)) {
            ui.notifications.error(
                `Cannot commit this item to GitHub — it must be imported from or opened directly from a supported compendium pack.`
            );
            return;
        }

        const _origButtonHTML = button?.innerHTML ?? null;
        if (button) button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Committing…`;
        try {

        // ── Authenticate first, before any server document fetches ──────────────────
        const identity = await GithubSyncManager.#ensureAuthenticated();
        if (!identity) return; // #ensureAuthenticated already notified

        // ── Resolve transitive dependencies ───────────────────────────────────
        const { committable, invalid } = await GithubSyncManager.#collectReferencedItems(
            document,
            new Set([document.uuid]),
            document.name,
            document.uuid
        );

        // Verify the primary item isn't blocked, using the server's copy as the baseline.
        let primaryServerData;
        try {
            primaryServerData = await GithubSyncManager.fetchServerDocument(document.type, document.id);
        } catch (error) {
            ui.notifications.error("Failed to reach the GitHub sync server.");
            console.error("GithubSync |", error);
            return;
        }
        if (primaryServerData && blockedItems(document.toObject?.() ?? document, primaryServerData)) {
            ui.notifications.error("This item cannot be committed to GitHub.");
            return;
        }

        // ── Prepare all blobs upfront (no staging yet) ────────────────────────
        let primaryBlob;
        try {
            primaryBlob = await GithubSyncManager.#prepareItemBlob(document);
        } catch (error) {
            ui.notifications.error("An unexpected error occurred while preparing the item.");
            console.error("GithubSync |", error);
            return;
        }
        if (!primaryBlob) return; // #prepareItemBlob already notified

        const depBlobs = [];
        for (const dep of committable) {
            let blob;
            try {
                blob = await GithubSyncManager.#prepareItemBlob(dep);
            } catch (error) {
                console.error(`GithubSync | Error preparing dependency "${dep.name}":`, error);
                blob = {
                    data: null, diff: null,
                    valid: false,
                    errors: [`Dependency "${dep.name}": unexpected error during preparation (see console).`],
                    warnings: [],
                };
            }
            if (blob) depBlobs.push({ item: dep, blob });
        }

        // ── Aggregate validation results ──────────────────────────────────────
        const allErrors = [
            ...primaryBlob.errors,
            ...invalid.map(({uuid, originName, originUuid}) =>
                `Referenced document could not be resolved to a supported compendium: ${uuid} (referenced by "${originName}" [${originUuid}])`
            ),
        ];
        const allWarnings = [...primaryBlob.warnings];

        for (const { item: dep, blob } of depBlobs) {
            allErrors.push(
                ...blob.errors.map((e) => `Dependency "${dep.name}": ${e}`)
            );
            allWarnings.push(
                ...blob.warnings.map((w) => `Dependency "${dep.name}": ${w}`)
            );
        }

        if (allErrors.length) {
            for (const err of allErrors) ui.notifications.error(err);
            return; // abort — nothing staged
        }

        GithubSyncManager.#lastWarnings = allWarnings;

        // ── Stage all blobs ───────────────────────────────────────────────────
        if (primaryBlob.data === null) {
            ui.notifications.info("No changes detected — nothing to commit.");
            return;
        }

        try {
            const primaryResult = await GithubSyncManager.saveBlobToGithub(
                primaryBlob.data,
                primaryBlob.diff
            );
            if (!primaryResult) return;

            const stagedDeps = depBlobs.filter(({ blob }) => blob.data !== null);
            if (stagedDeps.length) {
                // Resolve identity once for all dependency staging calls.
                const identity = await GithubSyncManager.getIdentity();
                if (!identity) {
                    ui.notifications.error("Unable to identify user for GitHub commit.");
                    return;
                }
                for (const { item: dep, blob } of stagedDeps) {
                    const result = await GithubSyncManager.#authenticatedFetch(
                        identity,
                        { data: blob.data, diff: blob.diff, flags: { new: true } }
                    );
                    if (!result?.success) {
                        ui.notifications.error(`Failed to stage dependency "${dep.name}". See console for details.`, { permanent: true });
                        console.error(`GithubSync | Failed to stage dependency "${dep.name}".`, result);
                    }
                }
            }
        } catch (error) {
            ui.notifications.error("An unexpected error occurred.", { permanent: true });
            console.error("GithubSync |", error);
            return;
        }

        GithubSyncManager.#openSheet();
        } finally {
            if (button) button.innerHTML = _origButtonHTML;
        }
    }

    /**
     * Main entry point for committing a JournalEntry to GitHub.
     *
     * Unlike items, journals have no transitive dependencies, so the pipeline
     * is simpler: prepare → validate → stage → open sheet.
     *
     * @param {JournalEntry} journal  The live Foundry JournalEntry to commit
     */
    static async commitJournalToGithub(journal, button = null) {
        if (!GithubSyncManager.isCommittableJournal(journal)) {
            ui.notifications.error(
                "Cannot commit this journal to GitHub — it must be opened directly from the configured journals compendium pack."
            );
            return;
        }

        const _origButtonHTML = button?._origButtonHTML ?? button?.innerHTML ?? null;
        if (button) {
            button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Committing…`;
            button._origButtonHTML = _origButtonHTML;
        }
        try {

        // ── Authenticate first, before any server document fetches ──────────────────
        const identity = await GithubSyncManager.#ensureAuthenticated();
        if (!identity) return; // #ensureAuthenticated already notified

        let blob;
        try {
            blob = await GithubSyncManager.#prepareJournalBlob(journal);
        } catch (error) {
            ui.notifications.error("An unexpected error occurred while preparing the journal.");
            console.error("GithubSync |", error);
            return;
        }
        if (!blob) return;

        if (blob.errors.length) {
            for (const err of blob.errors) ui.notifications.error(err);
            return;
        }

        GithubSyncManager.#lastWarnings = blob.warnings;

        if (blob.data === null) {
            ui.notifications.info("No changes detected — nothing to commit.");
            return;
        }

        try {
            const result = await GithubSyncManager.saveBlobToGithub(blob.data, blob.diff, { source: "journal" });
            if (!result) return;
        } catch (error) {
            ui.notifications.error("An unexpected error occurred.", { permanent: true });
            console.error("GithubSync |", error);
            return;
        }

        GithubSyncManager.#openSheet();
        } finally {
            if (button) button.innerHTML = _origButtonHTML;
        }
    }

    /**
     * Validate a document (and all its transitive referenced dependencies)
     * against the full commit pipeline — without staging anything.
     *
     * Useful from macros or the console to pre-check an item before committing:
     *   `await game.ptu.github.validateItem(item)`
     *
     * @param {Item} document  The live Foundry Item to validate
     * @returns {Promise<{ valid: boolean, errors: string[], warnings: string[] }>}
     */
    static async validateItem(document) {
        if (!GithubSyncManager.isCommittableItem(document)) {
            return {
                valid: false,
                errors: ["Item must be opened directly from a supported compendium pack."],
                warnings: [],
            };
        }

        const { committable, invalid } = await GithubSyncManager.#collectReferencedItems(
            document,
            new Set([document.uuid]),
            document.name,
            document.uuid
        );

        let primaryBlob;
        try {
            primaryBlob = await GithubSyncManager.#prepareItemBlob(document);
        } catch (error) {
            return {
                valid: false,
                errors: ["Unexpected error during preparation (see console)."],
                warnings: [],
            };
        }

        const allErrors = [
            ...(primaryBlob?.errors ?? ["Preparation failed."]),
            ...invalid.map(({uuid, originName, originUuid}) =>
                `Referenced document could not be resolved to a supported compendium: ${uuid} (referenced by "${originName}" [${originUuid}])`
            ),
        ];
        const allWarnings = [...(primaryBlob?.warnings ?? [])];

        for (const dep of committable) {
            let blob;
            try {
                blob = await GithubSyncManager.#prepareItemBlob(dep);
            } catch {
                allErrors.push(`Dependency "${dep.name}": unexpected error during preparation (see console).`);
                continue;
            }
            if (blob) {
                allErrors.push(...blob.errors.map((e) => `Dependency "${dep.name}": ${e}`));
                allWarnings.push(...blob.warnings.map((w) => `Dependency "${dep.name}": ${w}`));
            }
        }

        return { valid: allErrors.length === 0, errors: allErrors, warnings: allWarnings };
    }

    /**
     * Recursively collect all transitive documents referenced by `document`.
     * Uses `config.getReferencedDocuments` to get UUIDs, resolves each with
     * `fromUuidSync`, and recurses into committable items.
     *
     * @param {Item} document   The item whose references to collect
     * @param {Set<string>} visited  UUID strings already visited (cycle guard)
     * @returns {Promise<{ committable: Item[], invalid: string[] }>}
     *   `committable` — resolved items that can be committed.
     *   `invalid`     — UUIDs that could not be resolved or are not in a known pack.
     */
    /**
     * Recursively collect all transitive documents referenced by `document`.
     * Uses `config.getReferencedDocuments` to get UUIDs, resolves each with
     * `fromUuid`, and recurses into committable items.
     *
     * @param {Item} document   The item whose references to collect
     * @param {Set<string>} visited  UUID strings already visited (cycle guard)
     * @param {string} originName    Name of the referencing item (for error context)
     * @param {string} originUuid    UUID of the referencing item (for error context)
     * @returns {Promise<{ committable: Item[], invalid: Array<{uuid: string, originName: string, originUuid: string}> }>}
     *   `committable` — resolved items that can be committed.
     *   `invalid`     — objects with uuid, originName, originUuid for missing/invalid references.
     */
    static async #collectReferencedItems(document, visited, originName, originUuid) {
        const { getReferencedDocuments } = GithubSyncManager.config;
        const committable = [];
        const invalid = [];

        const uuids = getReferencedDocuments(document.toObject?.() ?? document);
        for (const uuid of uuids) {
            if (visited.has(uuid)) continue;
            visited.add(uuid);

            const resolved = await fromUuid(uuid);
            if (!resolved || !GithubSyncManager.isCommittableItem(resolved)) {
                invalid.push({ uuid, originName, originUuid });
                continue;
            }

            committable.push(resolved);

            // Recurse into this dependency's own references
            const nested = await GithubSyncManager.#collectReferencedItems(
                resolved,
                visited,
                resolved.name,
                resolved.uuid
            );
            committable.push(...nested.committable);
            invalid.push(...nested.invalid);
        }

        return { committable, invalid };
    }

    /**
     * Prepare a single item blob for staging: resolves the pack counterpart,
     * diffs (or strips metadata for new items), applies `transform`, then runs
     * `validateDocument`. Does NOT stage anything.
     *
     * @param {Item} item
     * @returns {Promise<{ data: object, diff: object, errors: string[], warnings: string[] }|null>}
     *   Returns `null` if a hard infrastructure error (e.g. pack not found)
     *   prevented preparation — in which case a user-facing notification has
     *   already been shown.
     */
    static async #prepareItemBlob(item) {
        const { transform, validateDocument } = GithubSyncManager.config;

        let serverData;
        try {
            serverData = await GithubSyncManager.fetchServerDocument(item.type, item.id);
        } catch (error) {
            ui.notifications.error("Failed to reach the GitHub sync server.");
            console.error("GithubSync |", error);
            return null;
        }

        let data, diff;
        if (!serverData) {
            // New item — not on the server yet
            data = GithubSyncManager.#stripMetadata(item.toObject());
            diff = {};
        } else {
            const itemData = item.toObject();

            diff = GithubSyncManager.getDiffableItem(itemData, serverData);

            if (fu.isEmpty(diff)) {
                // No changes — skip this item silently
                return { data: null, diff: null, errors: [], warnings: [] };
            }

            data = GithubSyncManager.prepareUpdateData(diff, serverData);
            if (data === null) {
                return { data: null, diff: null, errors: ["mergeCleanup returned null."], warnings: [] };
            }

            // Track renames so the server can move the file
            if (diff.name) diff.old_name = serverData.name;
        }

        // Apply system-specific transform (e.g. strip Forge/Sqyre image URLs)
        data = transform(data);

        // Validate
        const result = validateDocument(data);
        return {
            data,
            diff: diff ?? {},
            errors: result.errors ?? [],
            warnings: result.warnings ?? [],
        };
    }

    /**
     * Strip all Foundry/LevelDB metadata from a raw item object in place.
     * Used for new items that have no pack counterpart to diff against.
     * @param {object} data  Result of item.toObject()
     * @returns {object}
     */
    static #stripMetadata(data) {
        delete data._id;
        delete data._key;
        delete data._stats;
        delete data.sort;
        delete data.folder;
        delete data.ownership;
        if (data.flags?.core?.sourceId) delete data.flags.core.sourceId;
        if (fu.isEmpty(data.flags?.core)) delete data.flags?.core;
        if (fu.isEmpty(data.flags)) delete data.flags;
        return data;
    }

    /**
     * Prepare a single journal blob for staging: resolves the pack counterpart,
     * diffs using page-aware logic, applies `transform`, then validates.
     * Does NOT stage anything.
     *
     * @param {JournalEntry} journal
     * @returns {Promise<{ data: object, diff: object, errors: string[], warnings: string[] }|null>}
     */
    static async #prepareJournalBlob(journal) {
        const { transform, validateDocument } = GithubSyncManager.config;

        let serverData;
        try {
            serverData = await GithubSyncManager.fetchServerDocument("journal", journal.id);
        } catch (error) {
            ui.notifications.error("Failed to reach the GitHub sync server.");
            console.error("GithubSync |", error);
            return null;
        }

        let data, diff;
        if (!serverData) {
            // New journal — not on the server yet
            data = GithubSyncManager.#stripJournalMetadata(journal.toObject());
            diff = {};
        } else {
            const journalData = journal.toObject();

            diff = GithubSyncManager.getDiffableJournal(journalData, serverData);

            if (fu.isEmpty(diff)) {
                return { data: null, diff: null, errors: [], warnings: [] };
            }

            data = GithubSyncManager.#buildJournalData(journalData, serverData);

            // Track renames so the server can move the file
            if (diff.name) diff.old_name = serverData.name;
        }

        data = transform(data);

        const result = validateDocument(data);
        return {
            data,
            diff: diff ?? {},
            errors: result.errors ?? [],
            warnings: result.warnings ?? [],
        };
    }

    /**
     * Build the final journal data to send to the server.
     *  - Restores journal-level metadata from the pack version.
     *  - Restores each page's `_stats` and `ownership` from the corresponding
     *    pack page (matched by `_id`). New pages have those fields stripped.
     *
     * @param {object} journalData      Raw live journal (.toObject())
     * @param {object} packJournalData  Raw pack journal (.toObject())
     * @returns {object}
     */
    static #buildJournalData(journalData, packJournalData) {
        const data = fu.deepClone(journalData);

        // Restore journal-level metadata from pack (same logic as prepareUpdateData)
        for (const field of ["_id", "_key", "_stats", "ownership", "folder", "sort"]) {
            if (Object.hasOwn(packJournalData, field)) data[field] = packJournalData[field];
            else delete data[field];
        }

        if (data.flags?.core?.sourceId) delete data.flags.core.sourceId;
        if (fu.isEmpty(data.flags?.core)) delete data.flags?.core;
        if (fu.isEmpty(data.flags)) delete data.flags;

        // Restore each page's _stats and ownership from the pack (keyed by _id).
        // Pages that are new (not in the pack) have those fields stripped.
        const packPageById = new Map(
            (packJournalData.pages ?? []).map((p) => [p._id, p])
        );
        for (const page of data.pages ?? []) {
            const packPage = packPageById.get(page._id);
            if (packPage) {
                if (Object.hasOwn(packPage, "_stats")) page._stats = packPage._stats;
                else delete page._stats;
                if (Object.hasOwn(packPage, "ownership")) page.ownership = packPage.ownership;
                else delete page.ownership;
            } else {
                delete page._stats;
                delete page.ownership;
            }
        }

        return data;
    }

    /**
     * Strip Foundry metadata from a new journal that has no pack counterpart.
     * @param {object} data  Result of journal.toObject()
     * @returns {object}
     */
    static #stripJournalMetadata(data) {
        delete data._id;
        delete data._key;
        delete data._stats;
        delete data.sort;
        delete data.folder;
        delete data.ownership;
        if (data.flags?.core?.sourceId) delete data.flags.core.sourceId;
        if (fu.isEmpty(data.flags?.core)) delete data.flags?.core;
        if (fu.isEmpty(data.flags)) delete data.flags;
        for (const page of data.pages ?? []) {
            delete page._stats;
            delete page.ownership;
        }
        return data;
    }

    /** Open the commit manager UI (lazily, to avoid circular imports). */
    static #openSheet() {
        if (!GithubSyncManager.SheetClass) {
            console.warn("GithubSync | SheetClass not set — cannot open commit manager UI.");
            return;
        }
        new GithubSyncManager.SheetClass().render(true);
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Identity / authentication
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Resolve (or generate) the user's identity token.
     *
     * Flow:
     *  1. If a stored token exists, POST /identify with it.
     *     - 202 → still valid, return it.
     *     - 200 → expired, clear it and fall through.
     *  2. Generate a fresh random ID, POST /identify.
     *     - 200 → server returns a base64-encoded token; decode, save, return.
     *
     * @returns {Promise<string|null>}
     */
    /**
     * Ensure the user is authenticated with GitHub before making any server
     * document fetches. Calls GET /auth — a lightweight endpoint that returns
     * { success: true } if the identity is GitHub-linked, or { auth_url } if
     * OAuth is required. Polls until auth completes or times out.
     *
     * @returns {Promise<string|null>}  The identity token, or null if auth failed
     */
    static async #ensureAuthenticated() {
        const identity = await GithubSyncManager.getIdentity();
        if (!identity) {
            ui.notifications.error("Unable to identify user for GitHub commit.");
            return null;
        }

        const { apiUrl, poweredByHeader } = GithubSyncManager.config;
        let retries = 0;
        while (true) {
            let response;
            try {
                response = await fetch(`${apiUrl}/auth`, {
                    method: "GET",
                    headers: {
                        "X-Powered-By": poweredByHeader,
                        identity: btoa(identity),
                    },
                });
            } catch (err) {
                console.error("GithubSync | /auth request failed:", err);
                ui.notifications.error("Failed to reach the GitHub sync server.");
                return null;
            }

            const json = await response.json().catch(() => ({}));

            if (json.auth_url) {
                if (retries === 0) {
                    window.open(json.auth_url, "_blank");
                    ui.notifications.info("GitHub sign-in required — complete authentication in the browser window that just opened.");
                }
                if (retries >= 60) {
                    ui.notifications.error("GitHub authentication timed out — please try again.");
                    return null;
                }
                retries++;
                await new Promise((r) => setTimeout(r, 5000));
                continue;
            }

            if (!response.ok || !json.success) {
                ui.notifications.error("GitHub authentication failed — please try again.");
                return null;
            }

            return identity;
        }
    }

    static async getIdentity() {
        const { systemId, apiUrl, poweredByHeader, identitySettingKey } =
            GithubSyncManager.config;

        const stored = game.settings.get(systemId, identitySettingKey);
        if (stored) {
            let resp;
            try {
                resp = await fetch(`${apiUrl}/identify`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Powered-By": poweredByHeader,
                    },
                    body: JSON.stringify({ id: stored }),
                });
            } catch (err) {
                console.error("GithubSync | /identify request failed (stored token):", err);
                return null;
            }

            console.debug(`GithubSync | /identify (stored) → HTTP ${resp.status}`);

            if (resp.status === 202) return stored;
            if (resp.status === 200) {
                // Token is stale — clear and fall through to re-identify
                await game.settings.set(systemId, identitySettingKey, "");
            } else {
                const body = await resp.text().catch(() => "(unreadable)");
                console.error(
                    `GithubSync | /identify returned unexpected status ${resp.status}. Body:`,
                    body
                );
                return null;
            }
        }

        // Generate fresh identity
        const freshId = fu.randomID() + game.user.name + game.user.id;
        let resp;
        try {
            resp = await fetch(`${apiUrl}/identify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Powered-By": poweredByHeader,
                },
                body: JSON.stringify({ id: freshId }),
            });
        } catch (err) {
            console.error("GithubSync | /identify request failed (fresh token):", err);
            return null;
        }

        console.debug(`GithubSync | /identify (fresh) → HTTP ${resp.status}`);

        if (resp.status === 200) {
            const json = await resp.json();
            console.debug("GithubSync | /identify response body:", json);
            const encoded = json.identity;
            if (!encoded) {
                console.error(
                    'GithubSync | /identify returned HTTP 200 but response has no "identity" field.',
                    json
                );
                return null;
            }
            const identity = atob(encoded);
            await game.settings.set(systemId, identitySettingKey, identity);
            return identity;
        }

        const body = await resp.text().catch(() => "(unreadable)");
        console.error(
            `GithubSync | /identify returned unexpected status ${resp.status}. Body:`,
            body
        );
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  API calls
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch the server's current version of a document from the GitHub source
     * repository. This is the baseline used for all diff computations.
     *
     * Returns `null` when the document does not yet exist on the server
     * (i.e. it is a new document). Throws on unexpected server errors so
     * callers can surface a meaningful notification and abort.
     *
     * @param {string} type  Document type key from `documentTypes` (e.g. "move", "journal")
     * @param {string} id    The document's `_id`
     * @returns {Promise<object|null>}  Raw document JSON as stored on the server, or null if new
     * @throws {Error} If the server returns an unexpected non-404 error
     */
    static async fetchServerDocument(type, id) {
        const identity = await GithubSyncManager.getIdentity();
        if (!identity) {
            throw new Error("GithubSync: unable to identify user.");
        }

        const { apiUrl, poweredByHeader } = GithubSyncManager.config;
        const url = new URL(`${apiUrl}/document`);
        url.searchParams.set("type", type);
        url.searchParams.set("id", id);

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "X-Powered-By": poweredByHeader,
                identity: btoa(identity),
            },
        });

        if (response.status === 404) return null;

        if (!response.ok) {
            const body = await response.text().catch(() => "(unreadable)");
            throw new Error(`GithubSync: /document returned HTTP ${response.status}: ${body}`);
        }

        const json = await response.json();
        return json.data ?? null;
    }

    /**
     * Stage a single document blob on the backend server.
     *
     * @param {object} data  Fully resolved document (output of prepareUpdateData)
     * @param {object} [diff] Slim diff (with optional old_name for renames)
     * @param {object} [extraFlags] Additional flags merged into the request's `flags` object
     * @returns {Promise<object|null>}
     */
    static async saveBlobToGithub(data, diff = {}, extraFlags = {}) {
        const identity = await GithubSyncManager.getIdentity();
        if (!identity) {
            ui.notifications.error("Unable to identify user for GitHub commit.");
            return null;
        }

        const result = await GithubSyncManager.#authenticatedFetch(
            identity,
            { data, diff, flags: { new: true, ...extraFlags } }
        );

        if (result?.success) {
            ui.notifications.info("Successfully added file to next commit.");
        } else if (result?.error) {
            ui.notifications.error(`GitHub sync error: ${result.error}`, { permanent: true });
        } else if (!result) {
            ui.notifications.error("An unexpected error occurred.", { permanent: true });
        }

        return result;
    }

    /**
     * Finalize or cancel the pending commit.
     *
     * @param {object} [options]
     * @param {boolean|string} [options.deletePR=false]
     *   `true` → delete all staged blobs.
     *   `"path/to/file.json"` → delete one specific blob.
     * @param {string} [options.message]  Commit message
     * @param {string} [options.title]    Pull Request title
     * @returns {Promise<object|null>}
     */
    static async finalizeCommitToGithub({
        deletePR = false,
        message,
        title,
    } = {}) {
        const identity = await GithubSyncManager.getIdentity();
        if (!identity) {
            ui.notifications.error("Unable to identify user for GitHub commit.");
            return null;
        }

        const flags = {
            new: true,
            ...(deletePR ? { delete: deletePR } : { commit: true }),
            message: message ?? "Auto-generated commit from Foundry VTT.",
            ...(title ? { title } : {}),
        };

        const result = await GithubSyncManager.#authenticatedFetch(identity, { flags });

        if (result && !result.success) {
            if (result.error) ui.notifications.error(`GitHub sync error: ${result.error}`, { permanent: true });
            else ui.notifications.error("An unexpected error occurred.", { permanent: true });
        }

        return result;
    }

    /**
     * Fetch the list of currently staged blobs.
     * @returns {Promise<{success: boolean, blobs: {name: string, path: string, message: string}[]}|null>}
     */
    static async getCommitStatus() {
        const identity = await GithubSyncManager.getIdentity();
        if (!identity) {
            ui.notifications.error("Unable to identify user for GitHub commit.", { permanent: true });
            return null;
        }

        const result = await GithubSyncManager.#authenticatedFetch(
            identity,
            { flags: { new: true, status: true } }
        );

        if (!result) {
            ui.notifications.error("An unexpected error occurred.", { permanent: true });
            return { success: true, blobs: [] };
        }
        if (!result.success) {
            // 404 means no pending commit — treat as empty, not an error
            if (result.status === 404) {
                ui.notifications.info("Nothing sent to the server: it may already be up to date?", { permanent: true });
                return { success: true, blobs: [] };
            }
            if (result.error) ui.notifications.error(`GitHub sync error: ${result.error}`, { permanent: true });
            else ui.notifications.error("An unexpected error occurred.", { permanent: true });
        }

        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * POST to `{apiUrl}/commit` with identity header. If the server responds
     * with `{ auth_url }`, open a GitHub OAuth popup and retry once.
     *
     * @param {string} identity   Decoded identity token
     * @param {object} body       JSON-serialisable request body
     * @param {boolean} [retry]   Internal — true on the second attempt
     * @returns {Promise<object|null>}
     */
    static async #authenticatedFetch(identity, body, retries = 0) {
        const { apiUrl, poweredByHeader } = GithubSyncManager.config;

        const response = await fetch(`${apiUrl}/commit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Powered-By": poweredByHeader,
                identity: btoa(identity),
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            try {
                const json = await response.json();
                return { success: false, status: response.status, error: json.error };
            } catch {
                return { success: false, status: response.status };
            }
        }

        const json = await response.json();

        // Server requests GitHub OAuth before it can proceed
        if (json.auth_url) {
            if (retries >= 60) {
                ui.notifications.error("GitHub authentication timed out — please try again.");
                return null;
            }
            // Poll every 5 seconds until the server's OAuth callback has completed.
            await new Promise((r) => setTimeout(r, 5000));
            return GithubSyncManager.#authenticatedFetch(identity, body, retries + 1);
        }

        return json;
    }

}

export { GithubSyncManager };
