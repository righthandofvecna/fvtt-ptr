/**
 * @typedef {Object} TestEntry
 * @property {string} category  Category key (e.g. "rule-elements")
 * @property {string} name      Human-readable test name
 * @property {string} [description]
 * @property {function(): Promise<void>} fn  The test function; throw to fail
 */

/**
 * Registry of all integration tests. Tests call `TestRegistry.register(...)` at
 * module load time to add themselves.
 */
class TestRegistry {
    /** @type {Map<string, TestEntry[]>} */
    static #tests = new Map();

    /**
     * Register a test.
     *
     * @param {string} category - Grouping key, e.g. "rule-elements".
     * @param {string} name     - Test display name.
     * @param {function(): Promise<void>} fn - Test body; throw an Error to fail.
     * @param {object} [options]
     * @param {string} [options.description]
     */
    static register(category, name, fn, { description = "" } = {}) {
        if (!this.#tests.has(category)) this.#tests.set(category, []);
        this.#tests.get(category).push({ category, name, description, fn });
    }

    /** @returns {Map<string, TestEntry[]>} */
    static get categories() {
        return this.#tests;
    }

    /** @returns {TestEntry[]} All registered tests, in registration order */
    static get all() {
        return [...this.#tests.values()].flat();
    }

    /**
     * @param {string} category
     * @returns {TestEntry[]}
     */
    static forCategory(category) {
        return this.#tests.get(category) ?? [];
    }

    /** Clears all registered tests (useful during hot-reload in development). */
    static clear() {
        this.#tests.clear();
    }
}

export { TestRegistry };
