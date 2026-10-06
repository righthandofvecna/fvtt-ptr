import { TestRegistry } from "./registry.js";

/**
 * @typedef {Object} TestResult
 * @property {string} category
 * @property {string} name
 * @property {"pass"|"fail"|"pending"} status
 * @property {string|null} error   - Error message if status is "fail"
 * @property {number|null} duration - Milliseconds
 */

/**
 * The currently-executing test context.  Helper utilities (actors, items, tokens)
 * read this to generate descriptive names for test-created documents.
 * @type {{ category: string, name: string } | null}
 */
export let currentTestContext = null;

/**
 * Runs registered integration tests and yields results.
 * Tests that throw are marked as "fail"; any other completion is "pass".
 * On failure, the actor/token state is intentionally left for inspection.
 */
class TestRunner {
    /**
     * Run a single test entry.
     *
     * @param {import("./registry.js").TestEntry} entry
     * @returns {Promise<TestResult>}
     */
    async runOne(entry) {
        currentTestContext = { category: entry.category, name: entry.name };
        const start = performance.now();
        try {
            await entry.fn();
            return {
                category: entry.category,
                name: entry.name,
                status: "pass",
                error: null,
                duration: Math.round(performance.now() - start),
            };
        } catch (err) {
            console.error(`PTU Tests | FAIL [${entry.category}] "${entry.name}"`, err);
            return {
                category: entry.category,
                name: entry.name,
                status: "fail",
                error: err?.message ?? String(err),
                duration: Math.round(performance.now() - start),
            };
        } finally {
            currentTestContext = null;
        }
    }

    /**
     * Run all tests in a category.
     *
     * @param {string} category
     * @param {function(TestResult): void} [onResult] - Called after each test completes.
     * @returns {Promise<TestResult[]>}
     */
    async runCategory(category, onResult) {
        const entries = TestRegistry.forCategory(category);
        const results = [];
        for (const entry of entries) {
            const result = await this.runOne(entry);
            results.push(result);
            onResult?.(result);
        }
        return results;
    }

    /**
     * Run every registered test.
     *
     * @param {function(TestResult): void} [onResult] - Called after each test completes.
     * @returns {Promise<TestResult[]>}
     */
    async runAll(onResult) {
        const all = TestRegistry.all;
        const results = [];
        for (const entry of all) {
            const result = await this.runOne(entry);
            results.push(result);
            onResult?.(result);
        }
        return results;
    }
}

export { TestRunner };
