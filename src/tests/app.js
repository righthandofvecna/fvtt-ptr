import { TestRegistry } from "./registry.js";
import { TestRunner } from "./runner.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * AppV2 dialog that displays and runs PTU integration tests.
 *
 * Open via:
 *   game.ptu.tests.open()   – open/bring to front without running
 *   game.ptu.tests.run()    – open and immediately run all tests
 */
export class PTUTestApp extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: "ptu-test-suite",
        classes: ["ptu", "test-suite"],
        position: {
            width: 700,
            height: 600,
        },
        window: {
            title: "PTU Test Suite",
            minimizable: true,
            resizable: true,
        },
        actions: {
            runAll: async function() {
                await this.runAll();
            },
            runCategory: async function(event, target) {
                const category = target.dataset.category;
                if (!category) return;
                await this._runTests(TestRegistry.forCategory(category));
            },
            runTest: async function(event, target) {
                const key = target.dataset.key;
                if (!key) return;
                const [category, ...nameParts] = key.split("::");
                const name = nameParts.join("::");
                const entry = TestRegistry.forCategory(category).find(e => e.name === name);
                if (!entry) return;
                await this._runTests([entry]);
            },
            clearResults: function() {
                this._results.clear();
                this.render({ force: true });
            },
            copyFailures: function() {
                const failures = [...this._results.values()].filter(r => r.status === "fail");
                if (!failures.length) {
                    ui.notifications.info("No failures to copy.");
                    return;
                }
                const text = failures.map(r =>
                    `[FAIL] ${r.category} > ${r.name}\n  ${r.error ?? "(no error message)"}`
                ).join("\n\n");
                game.clipboard.copyPlainText(text);
                ui.notifications.info(`Copied ${failures.length} failure(s) to clipboard.`);
            },
        },
    };

    static PARTS = {
        content: {
            template: "systems/ptu/static/templates/apps/test-suite.hbs",
        },
    };

    /** @type {Map<string, import("./runner.js").TestResult>} key = "category::name" */
    _results = new Map();
    _isRunning = false;
    _runner = new TestRunner();

    // ---------- public API ----------

    /**
     * Programmatically run all tests (can be called before or after rendering).
     * @returns {Promise<void>}
     */
    async runAll() {
        await this._runTests(TestRegistry.all);
    }

    // ---------- internal ----------

    async _runTests(entries) {
        if (this._isRunning) return;
        this._isRunning = true;

        // Mark selected tests as "running"
        for (const entry of entries) {
            this._results.set(this._key(entry), { ...entry, status: "running", error: null, duration: null });
        }
        await this.render({ force: true });

        for (const entry of entries) {
            const result = await this._runner.runOne(entry);
            this._results.set(this._key(entry), result);
            await this.render({ force: true });
        }

        this._isRunning = false;
        await this.render({ force: true });
    }

    _key(entry) {
        return `${entry.category}::${entry.name}`;
    }

    // ---------- AppV2 overrides ----------

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        let totalPassed = 0;
        let totalFailed = 0;
        let totalDuration = 0;
        let hasAnyResult = false;

        const categories = [];
        for (const [key, entries] of TestRegistry.categories) {
            let catPassed = 0;
            let catFailed = 0;
            let catHasResults = false;

            const tests = entries.map(entry => {
                const result = this._results.get(this._key(entry));
                const status = result?.status ?? "pending";
                const duration = result?.duration ?? null;
                const error = result?.error ?? null;

                if (result) {
                    catHasResults = true;
                    hasAnyResult = true;
                    if (status === "pass") { catPassed++; totalPassed++; }
                    if (status === "fail") { catFailed++; totalFailed++; }
                    if (duration) totalDuration += duration;
                }

                return { name: entry.name, status, duration, error, testKey: this._key(entry) };
            });

            const catTotal = entries.length;
            categories.push({
                key,
                label: this._formatCategoryLabel(key),
                tests,
                total: catTotal,
                passed: catPassed,
                failed: catFailed,
                hasResults: catHasResults,
                categoryCssClass: catFailed > 0 ? "has-failures" : "all-pass",
            });
        }

        const totalTests = TestRegistry.all.length;
        const summary = hasAnyResult ? {
            passed: totalPassed,
            total: totalPassed + totalFailed,
            duration: totalDuration,
            cssClass: totalFailed > 0 ? "has-failures" : "all-pass",
        } : null;

        return {
            ...context,
            categories,
            totalTests,
            summary,
            isRunning: this._isRunning,
        };
    }

    _formatCategoryLabel(key) {
        return key.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    }
}
