/**
 * Throws an error if condition is falsy.
 * @param {*} condition
 * @param {string} [message]
 */
function assert(condition, message = "Assertion failed") {
    if (!condition) throw new Error(message);
}

/**
 * Throws if actual !== expected (strict equality).
 * @param {*} actual
 * @param {*} expected
 * @param {string} [message]
 */
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message ?? `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
    }
}

/**
 * Throws if actual === unexpected.
 * @param {*} actual
 * @param {*} unexpected
 * @param {string} [message]
 */
function assertNotEqual(actual, unexpected, message) {
    if (actual === unexpected) {
        throw new Error(message ?? `Expected value to not equal ${JSON.stringify(unexpected)}`);
    }
}

/**
 * Throws if |actual - expected| > delta.
 * @param {number} actual
 * @param {number} expected
 * @param {number} [delta=0.001]
 * @param {string} [message]
 */
function assertApprox(actual, expected, delta = 0.001, message) {
    if (Math.abs(actual - expected) > delta) {
        throw new Error(message ?? `Expected ${actual} to approximately equal ${expected} (±${delta})`);
    }
}

/**
 * Throws if the array or Set does not contain the value.
 * @param {Array|Set} collection
 * @param {*} value
 * @param {string} [message]
 */
function assertContains(collection, value, message) {
    const has = Array.isArray(collection) ? collection.includes(value) : collection.has?.(value) ?? false;
    if (!has) {
        const repr = Array.isArray(collection) ? JSON.stringify(collection) : `[Set: ${[...collection].join(", ")}]`;
        throw new Error(message ?? `Expected collection to contain ${JSON.stringify(value)}. Collection: ${repr}`);
    }
}

/**
 * Throws if the array or Set contains the value.
 * @param {Array|Set} collection
 * @param {*} value
 * @param {string} [message]
 */
function assertNotContains(collection, value, message) {
    const has = Array.isArray(collection) ? collection.includes(value) : collection.has?.(value) ?? false;
    if (has) {
        throw new Error(message ?? `Expected collection to NOT contain ${JSON.stringify(value)}`);
    }
}

/**
 * Throws if value is null or undefined.
 * @param {*} value
 * @param {string} [message]
 */
function assertDefined(value, message) {
    if (value === undefined || value === null) {
        throw new Error(message ?? `Expected value to be defined, but got ${value}`);
    }
}

/**
 * Throws if actual <= min.
 * @param {number} actual
 * @param {number} min
 * @param {string} [message]
 */
function assertGreaterThan(actual, min, message) {
    if (actual <= min) {
        throw new Error(message ?? `Expected ${actual} to be greater than ${min}`);
    }
}

/**
 * Throws if actual < min.
 * @param {number} actual
 * @param {number} min
 * @param {string} [message]
 */
function assertAtLeast(actual, min, message) {
    if (actual < min) {
        throw new Error(message ?? `Expected ${actual} to be at least ${min}`);
    }
}

export {
    assert,
    assertEqual,
    assertNotEqual,
    assertApprox,
    assertContains,
    assertNotContains,
    assertDefined,
    assertGreaterThan,
    assertAtLeast,
};
