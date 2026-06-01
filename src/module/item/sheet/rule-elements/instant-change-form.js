import { isObject } from '../../../../util/misc.js';
import { isBracketedValue } from '../../../rules/rule-element/base.js';
import { RuleElementForm } from './base.js';

class InstantChangeForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/instant-change.hbs";
    }

    /** @override */
    async getData() {
        const data = await super.getData();

        const valueMode = isBracketedValue(this.rule.value)
            ? "brackets"
            : isObject(this.rule.value)
            ? "object"
            : "primitive";

        if (this.rule.predicate === undefined) this.updateItem({ predicate: [] });

        const ruleTriggers = {
            "onCreate":       "PTU.RuleEditor.InstantChange.Triggers.OnCreate",
            "onDelete":       "PTU.RuleEditor.InstantChange.Triggers.OnDelete",
            "onTurnStart":    "PTU.RuleEditor.InstantChange.Triggers.OnTurnStart",
            "onTurnEnd":      "PTU.RuleEditor.InstantChange.Triggers.OnTurnEnd",
            "onCombatStart":  "PTU.RuleEditor.InstantChange.Triggers.OnCombatStart",
            "onCombatEnd":    "PTU.RuleEditor.InstantChange.Triggers.OnCombatEnd",
            "onRoundStart":   "PTU.RuleEditor.InstantChange.Triggers.OnRoundStart",
            "onRoll":         "PTU.RuleEditor.InstantChange.Triggers.OnRoll",
        };

        const ruleModes = {
            "add":       "PTU.RuleEditor.General.Modes.Add",
            "subtract":  "PTU.RuleEditor.General.Modes.Subtract",
            "remove":    "PTU.RuleEditor.General.Modes.Remove",
            "multiply":  "PTU.RuleEditor.General.Modes.Multiply",
            "downgrade": "PTU.RuleEditor.General.Modes.Downgrade",
            "upgrade":   "PTU.RuleEditor.General.Modes.Upgrade",
            "override":  "PTU.RuleEditor.General.Modes.Override",
        };

        return {
            ...data,
            ruleTriggers,
            ruleModes,
            selectorsAsString: (this.rule.selectors ?? []).join(", "),
            predicationIsMultiple: Array.isArray(this.rule.predicate) && this.rule.predicate.every(p => typeof p === "string"),
            value: {
                mode: valueMode,
                data: this.rule.value,
            },
        };
    }

    /** @override */
    activateListeners(html) {
        html.querySelector("[data-action=toggle-predicate]")?.addEventListener("click", () => {
            const predicate = this.rule.predicate;
            const newValue = Array.isArray(predicate)
                ? { "and": predicate.length ? predicate : [] }
                : predicate?.["and"]?.length ? predicate["and"] : [];
            this.updateItem({ predicate: newValue });
        });

        html.querySelector("[data-action=toggle-brackets]")?.addEventListener("click", () => {
            const value = this.rule.value;
            if (isBracketedValue(value)) {
                this.updateItem({ value: "" });
            } else {
                this.updateItem({ value: { brackets: [{ value: "" }] } });
            }
        });

        for (const button of html.querySelectorAll("[data-action=bracket-add]")) {
            button.addEventListener("click", () => {
                const value = this.rule.value;
                if (isBracketedValue(value)) {
                    value.brackets.push({ value: "" });
                    this.updateItem({ value });
                }
            });
        }

        for (const button of html.querySelectorAll("[data-action=bracket-delete]")) {
            button.addEventListener("click", (event) => {
                const value = this.rule.value;
                const idx = Number(event.target?.closest("[data-idx]")?.dataset.idx);
                if (isBracketedValue(value)) {
                    value.brackets.splice(idx, 1);
                    this.updateItem({ value });
                }
            });
        }
    }

    /** @override */
    _updateObject(formData) {
        if (isObject(formData.value) && "brackets" in formData.value) {
            const brackets = (formData.value.brackets = Array.from(Object.values(formData.value.brackets ?? {})));

            if (formData.value.field === "") {
                delete formData.value.field;
            }

            for (const bracket of brackets) {
                if (bracket.start === null) delete bracket.start;
                if (bracket.end === null) delete bracket.end;
                bracket.value = isObject(bracket.value) ? "" : this.coerceNumber(bracket.value);
            }
        } else if (!isObject(formData.value)) {
            formData.value = this.coerceNumber(formData.value ?? "");
        }

        if (Array.isArray(formData.predicate) && formData.predicate.every(p => !!p.value)) {
            formData.predicate = formData.predicate.map(s => s.value).filter(s => !!s);
        }

        // Convert comma-separated selectors string back to array
        if (typeof formData.selectors === "string") {
            formData.selectors = formData.selectors
                .split(",")
                .map(s => s.trim())
                .filter(s => !!s);
        }

        for (const optional of ["label"]) {
            if (!formData[optional]) {
                delete formData[optional];
            }
        }
    }
}

export { InstantChangeForm };
