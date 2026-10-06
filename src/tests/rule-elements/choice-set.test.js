/**
 * Tests for the ChoiceSet rule element.
 *
 * ChoiceSet prompts the user to pick from a list of choices when an item is added
 * to an actor.  Without a `selection` pre-specified, it disables all other rule
 * elements on the parent item (waiting for user input).
 *
 * For integration tests we always pre-supply a `selection` to avoid the dialog.
 */
import { TestRegistry } from "../registry.js";
import { createTestPokemonNoSpecies, deleteTestActor } from "../helpers/actors.js";
import { addEffectWithRules } from "../helpers/items.js";
import { assertDefined, assertEqual } from "../helpers/assert.js";

const CATEGORY = "rule-elements";

// -----------------------------------------------------------------
// Pre-supplied selection stores the value in item flags and sets a roll option
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "ChoiceSet | pre-supplied selection stores value in item flags", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        const item = await addEffectWithRules(actor, [{
            key: "ChoiceSet",
            flag: "testChoiceFlag",
            selection: "option-a",
            choices: [
                { value: "option-a", label: "Option A" },
                { value: "option-b", label: "Option B" },
            ],
        }]);

        actor = game.actors.get(actor.id);

        const effect = actor.items.get(item.id);
        assertDefined(effect, "Effect item should be on the actor");
        const selection = effect?.flags?.ptu?.rulesSelections?.["testChoiceFlag"];
        assertEqual(selection, "option-a", "rulesSelections should store the pre-supplied selection");

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});

// -----------------------------------------------------------------
// Without a selection and allowNoSelection=true, the ChoiceSet is ignored;
// we use a Hooks.once to auto-dismiss the dialog so it doesn't block the test runner.
// -----------------------------------------------------------------
TestRegistry.register(CATEGORY, "ChoiceSet | without selection, other rules on same item are disabled", async () => {
    let actor = await createTestPokemonNoSpecies();
    try {
        // Register a one-shot hook that auto-closes the ChoiceSet dialog before
        // it requires user input. The dialog is an AppV1 Application named "ChoiceSetPrompt".
        let hookId = null;
        hookId = Hooks.on("renderChoiceSetPrompt", (app) => {
            Hooks.off("renderChoiceSetPrompt", hookId);
            // Slight delay to ensure the dialog is fully rendered before closing.
            setTimeout(() => app.close(), 50);
        });

        try {
            // allowNoSelection=false is the default. With no selection and the dialog dismissed,
            // preCreate will throw. We let it fail silently so we can still inspect the actor.
            await addEffectWithRules(actor, [
                {
                    key: "ChoiceSet",
                    flag: "noSelFlag",
                    allowNoSelection: false,
                    choices: [
                        { value: "a", label: "A" },
                        { value: "b", label: "B" },
                    ],
                },
                {
                    key: "RollOption",
                    domain: "all",
                    option: "choice-set-sibling-option",
                },
            ]);
        } catch {
            // Expected: preCreate throws when no selection is made and allowNoSelection=false.
            Hooks.off("renderChoiceSetPrompt", hookId);
        }

        // The item should not have been added (preCreate failed), so the roll option is absent.
        actor = game.actors.get(actor.id);
        const options = actor.getRollOptions(["all"]);
        if (options.includes("choice-set-sibling-option")) {
            throw new Error("RollOption on the same item as an un-answered ChoiceSet should not be active");
        }

        await deleteTestActor(actor);
    } catch (err) {
        throw err;
    }
});
