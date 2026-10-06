/**
 * PTU Integration Test Suite
 *
 * Entry point — imports all test files (which self-register) and exposes the
 * public API that is attached to `game.ptu.tests` in GamePTU.onReady().
 *
 * Usage from a Foundry macro:
 *   game.ptu.tests.run()   // open dialog and run all tests
 *   game.ptu.tests.open()  // open dialog without running
 */
import { TestRegistry } from "./registry.js";
import { TestRunner } from "./runner.js";
import { PTUTestApp } from "./app.js";

// ---- import all test suites so they self-register ----
import "./rule-elements/ae-like.test.js";
import "./rule-elements/flat-modifier.test.js";
import "./rule-elements/roll-option.test.js";
import "./rule-elements/type-overwrite.test.js";
import "./rule-elements/grant-item.test.js";
import "./rule-elements/apply-effect.test.js";
import "./rule-elements/token-overrides.test.js";
import "./rule-elements/temp-hp.test.js";
import "./rule-elements/effectiveness.test.js";
import "./rule-elements/ephemeral-effect.test.js";
import "./rule-elements/reminder.test.js";
import "./rule-elements/heal-on-damage-dealt.test.js";
import "./rule-elements/temp-species.test.js";
import "./rule-elements/instant-change.test.js";
import "./rule-elements/choice-set.test.js";
import "./rule-elements/action-point.test.js";

/** Singleton app instance reused across opens. */
let _app = null;

function getApp() {
    if (!_app || _app._state < 0) _app = new PTUTestApp();
    return _app;
}

/**
 * Public API attached to `game.ptu.tests`.
 */
const PTUTests = {
    /** The registry of all registered tests. */
    registry: TestRegistry,

    /** A bare runner for programmatic use (no UI). */
    runner: new TestRunner(),

    /**
     * Open the test suite dialog without running tests.
     * @returns {PTUTestApp}
     */
    open() {
        const app = getApp();
        app.render({ force: true });
        return app;
    },

    /**
     * Open the test suite dialog and immediately run all tests.
     * @returns {Promise<PTUTestApp>}
     */
    async run() {
        const app = getApp();
        app.render({ force: true });
        // Small delay to let the dialog render before kicking off the run.
        await new Promise(resolve => setTimeout(resolve, 150));
        await app.runAll();
        return app;
    },
};

export { PTUTests, PTUTestApp, TestRegistry, TestRunner };
