import { RuleElements } from "../rules/index.js";
import { RULE_ELEMENT_FORMS, RuleElementForm } from "../item/sheet/rule-elements/index.js";
import { sortStringRecord } from "../../util/misc.js";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

class PTUKeywordJournalPage extends JournalEntryPage {
    get rules() {
        return this.system.rules;
    }
}

class PTUKeywordJournalPageSheet extends foundry.appv1.sheets.JournalTextPageSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: [...super.defaultOptions.classes, "ptu-sheet"],
            scrollY: [".rules-list"],
        });
    }

    get template() {
        return this.isEditable
            ? "systems/ptu/static/templates/apps/journal/keyword-page-edit.hbs"
            : "systems/ptu/static/templates/apps/journal/keyword-page-view.hbs";
    }

    async getData(options = {}) {
        const data = await super.getData(options);

        // Disable collaborative editing — keyword pages are GM-authored content
        // and the collaboration ProseMirror plugin requires DOM layout that our
        // custom template doesn't provide, causing console errors.
        if (data.editor) data.editor.collaborate = false;

        const rules = this.object.toObject().system.rules ?? [];

        data.rules = {
            cards: await Promise.all(rules.map(async (rule, index) => {
                const key = rule.key;
                const label = game.i18n.localize(`PTU.RuleElement.${key}.Label`);
                const recognized = label !== `PTU.RuleElement.${key}.Label`;
                const sublabel = await RuleElements.getRuleElementDocument(rule.key).description(rule)
                console.log("KW Rule", rule, label, sublabel);
                return {
                    index,
                    rule,
                    label: recognized ? label : game.i18n.localize("PTU.RuleElement.Unrecognized.Label"),
                    sublabel,
                    recognized,
                };
            })),
            selection: {
                selected: this.selectedRuleElementType,
                types: sortStringRecord(
                    Object.keys(RuleElements.all).reduce(
                        (result, key) => foundry.utils.mergeObject(result, { [key]: `RULES.Types.${key}` }),
                        {}
                    )
                ),
            },
        };

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('select[data-action=select-rule-element]').on('change', (event) => {
            this.selectedRuleElementType = event.target.value;
        });

        html.find('a.add-rule-element').click(async (event) => {
            await this.saveEditor("text.content", { preventRender: true }).catch(() => {});
            const rulesData = this.object.toObject().system.rules ?? [];
            const key = this.selectedRuleElementType ?? "ActiveEffectLike";
            await this.object.update({ "system.rules": rulesData.concat({ key }) });
            this.render(false, { resync: true });
        });

        html.find('a.remove-rule-element').click(async (event) => {
            await this.saveEditor("text.content", { preventRender: true }).catch(() => {});
            const rulesData = this.object.toObject().system.rules ?? [];
            const index = Number(event.currentTarget.dataset.ruleIndex ?? NaN);
            if (rulesData && Number.isInteger(index) && rulesData.length > index) {
                rulesData.splice(index, 1);
                await this.object.update({ "system.rules": rulesData });
                this.render(false, { resync: true });
            }
        });

        html.find('a.edit-rule-element').click(async (event) => {
            const index = Number(event.currentTarget.dataset.ruleIndex ?? NaN);
            if (!Number.isInteger(index)) return;
            const dialog = new KeywordRuleElementDialog(this.object, index);
            dialog.render(true);
        });
    }
}

/**
 * AppV2 dialog for editing a single rule element on a keyword journal page.
 * Isolated from the main journal page form to avoid FormDataExtended conflicts.
 */
class KeywordRuleElementDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        classes: ["ptu", "keyword-rule-dialog"],
        position: { width: 520, height: "auto" },
        window: {
            title: "PTU.KeywordRuleElementDialog.Title",
            resizable: true,
        },
    };

    static PARTS = {
        content: {
            template: "systems/ptu/static/templates/apps/journal/keyword-rule-dialog.hbs",
        },
    };

    constructor(page, index, options = {}) {
        super({ ...options, id: `keyword-rule-dialog-${page.id}-${index}` });
        this.page = page;
        this.index = index;
    }

    /** @override */
    async _prepareContext(options) {
        const rules = this.page.toObject().system.rules ?? [];
        const rule = rules[this.index] ?? {};
        const FormClass = RULE_ELEMENT_FORMS[String(rule.key)] ?? RuleElementForm;
        this._ruleForm = new FormClass({ item: this.page, index: this.index, rule, object: null });
        return {
            ruleTemplate: await this._ruleForm.render(),
            rule,
            index: this.index,
        };
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);

        // Activate the rule element form's interactive listeners (toggle buttons, etc.)
        const ruleBody = this.element.querySelector(".rule-body");
        if (ruleBody && this._ruleForm) {
            this._ruleForm.activateListeners(ruleBody);
        }

        // Re-render the dialog when the underlying document changes (e.g., from updateItem calls
        // triggered by interactive toggle buttons inside the rule form).
        if (this._pageUpdateHook !== undefined) {
            Hooks.off("updateJournalEntryPage", this._pageUpdateHook);
        }
        this._pageUpdateHook = Hooks.on("updateJournalEntryPage", async (page) => {
            if (page.id === this.page.id && !this._isSaving) {
                this.page = page;
                this.render();
            }
        });

        this.element.querySelector("[data-action=save-rule]")?.addEventListener("click", async () => {
            await this._saveRule();
        });
    }

    /** @override */
    async close(options = {}) {
        if (this._pageUpdateHook !== undefined) {
            Hooks.off("updateJournalEntryPage", this._pageUpdateHook);
            this._pageUpdateHook = undefined;
        }
        return super.close(options);
    }

    async _saveRule() {
        const form = this.element.querySelector("form");
        if (!form) return;

        // Collect form data manually to avoid FormDataExtended's automatic JSON coercion,
        // which throws "unexpected end of JSON input" on partial or empty JSON fields.
        const rawData = {};
        for (const el of form.elements) {
            if (!el.name) continue;
            let value = el.type === "checkbox" ? el.checked : el.value;
            // Parse fields explicitly marked as JSON dtype
            if (el.dataset?.dtype === "JSON" && typeof value === "string" && value.trim()) {
                try { value = JSON.parse(value); } catch { /* keep as raw string */ }
            }
            rawData[el.name] = value;
        }

        const expanded = foundry.utils.expandObject(rawData);
        const rules = this.page.toObject().system.rules ?? [];
        const ruleValue = foundry.utils.getProperty(expanded, `system.rules.${this.index}`);

        if (ruleValue === undefined) return;

        this._isSaving = true;
        try {
            if (typeof ruleValue === "string") {
                // Default textarea template — treat as raw JSON for the entire rule
                try {
                    rules[this.index] = JSON.parse(ruleValue);
                } catch (err) {
                    ui.notifications.error(game.i18n.format("PTU.RuleParseSyntaxError", { message: err?.message }));
                    return;
                }
            } else {
                rules[this.index] = foundry.utils.mergeObject(rules[this.index] ?? {}, ruleValue);
                this._ruleForm?._updateObject(rules[this.index]);

                const predicate = rules[this.index].predicate;
                if (typeof predicate === "string" && predicate.trim() === "") {
                    delete rules[this.index].predicate;
                } else if (typeof predicate === "string") {
                    try {
                        rules[this.index].predicate = JSON.parse(predicate);
                    } catch (err) {
                        ui.notifications.error(game.i18n.format("PTU.RuleParseSyntaxError", { message: err?.message }));
                        return;
                    }
                }
            }

            await this.page.update({ "system.rules": rules });
        } finally {
            this._isSaving = false;
        }

        this.close();
    }
}

export { PTUKeywordJournalPage, PTUKeywordJournalPageSheet }
