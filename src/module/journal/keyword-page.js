import { RuleElements } from "../rules/index.js";
import { RULE_ELEMENT_FORMS, RuleElementForm } from "../item/sheet/rule-elements/index.js";
import { sortStringRecord } from "../../util/misc.js";

class PTUKeywordJournalPage extends JournalEntryPage {
    get rules() {
        return this.system.rules;
    }
}

class PTUKeywordJournalPageSheet extends foundry.appv1.sheets.JournalTextPageSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: ".item-list" }],
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
        this.ruleElementForms = {};
        for (const [index, rule] of rules.entries()) {
            const FormClass = RULE_ELEMENT_FORMS[String(rule.key)] ?? RuleElementForm;
            this.ruleElementForms[index] = new FormClass({
                item: this.object,
                index,
                rule,
                object: null
            });
        }

        data.rules = {
            labels: rules.map(rule => {
                const key = String(rule.key).replace(/^PTU\.RuleElement\./, "");
                const label = game.i18n.localize(`PTU.RuleElement.${key}`);
                const recognized = label !== `PTU.RuleElement.${key}`;
                return { label: recognized ? label : game.i18n.localize("PTU.RuleElement.Unrecognized"), recognized };
            }),
            selection: {
                selected: this.selectedRuleElementType,
                types: sortStringRecord(
                    Object.keys(RuleElements.all).reduce(
                        (result, key) => foundry.utils.mergeObject(result, { [key]: `RULES.Types.${key}` }),
                        {}
                    )
                )
            },
            elements: await Promise.all(
                rules.map(async (rule, index) => ({
                    template: await this.ruleElementForms[index].render(),
                    index,
                    rule
                }))
            )
        };

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('select[data-action=select-rule-element]').on('change', (event) => {
            this.selectedRuleElementType = event.target.value;
        });

        html.find('a.add-rule-element').click(async (event) => {
            // Save any pending editor content without triggering a full re-render
            await this.saveEditor("text.content", { preventRender: true }).catch(() => {});
            const rulesData = this.object.toObject().system.rules ?? [];
            const key = this.selectedRuleElementType ?? "ActiveEffectLike";
            await this.object.update({ "system.rules": rulesData.concat({ key }) });
            this.render(false, { resync: true });
        });

        html.find('a.remove-rule-element').click(async (event) => {
            // Save any pending editor content without triggering a full re-render
            await this.saveEditor("text.content", { preventRender: true }).catch(() => {});
            const rulesData = this.object.toObject().system.rules ?? [];
            const index = Number(event.currentTarget.dataset.ruleIndex ?? NaN);
            if (rulesData && Number.isInteger(index) && rulesData.length > index) {
                rulesData.splice(index, 1);
                await this.object.update({ "system.rules": rulesData });
                this.render(false, { resync: true });
            }
        });

        const rulesSections = html.find(".rules .rule-body");
        for (const ruleSection of rulesSections) {
            const idx = ruleSection.dataset.idx ? Number(ruleSection.dataset.idx) : NaN;
            const form = this.ruleElementForms[idx];
            if (form) {
                form.activateListeners(ruleSection);
            }
        }
    }
    /** @override */
    async _updateObject(event, formData) {
        const expanded = foundry.utils.expandObject(formData);

        if (expanded.system?.rules) {
            const rules = this.object.toObject().system.rules ?? [];

            for (const [key, value] of Object.entries(expanded.system.rules)) {
                const idx = Number(key);
                if (!Number.isInteger(idx) || idx >= rules.length) continue;

                if (typeof value === "string") {
                    try {
                        rules[idx] = JSON.parse(value);
                    } catch (error) {
                        ui.notifications.error(game.i18n.format("PTU.RuleParseSyntaxError", { message: error?.message }));
                        throw error;
                    }
                    continue;
                }

                if (!value) continue;

                rules[idx] = foundry.utils.mergeObject(rules[idx] ?? {}, value);
                this.ruleElementForms[idx]?._updateObject(rules[idx]);

                const predicate = rules[idx].predicate;
                if (typeof predicate === "string" && predicate.trim() === "") {
                    delete rules[idx].predicate;
                } else if (typeof predicate === "string") {
                    try {
                        rules[idx].predicate = JSON.parse(predicate);
                    } catch (error) {
                        ui.notifications.error(game.i18n.format("PTU.RuleParseSyntaxError", { message: error?.message }));
                        throw error;
                    }
                }
            }

            expanded.system.rules = rules;
        }

        return super._updateObject(event, foundry.utils.flattenObject(expanded));
    }
}

export { PTUKeywordJournalPage, PTUKeywordJournalPageSheet }