import { RuleElementForm } from './base.js';

class HealOnDamageDealtForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/heal-on-damage-dealt.hbs";
    }

    /** @override */
    async getData() {
        const data = await super.getData();

        if (this.rule.predicate === undefined) this.updateItem({ predicate: [] });

        return {
            ...data,
            selectorIsArray: Array.isArray(this.rule.selectors),
            predicationIsMultiple: Array.isArray(this.rule.predicate) && this.rule.predicate.every(p => typeof p === "string"),
        };
    }

    /** @override */
    activateListeners(html) {
        html.querySelector("[data-action=toggle-selector]")?.addEventListener("click", () => {
            const selector = this.rule.selectors;
            const newValue = Array.isArray(selector) ? selector.at(0) ?? "" : [selector ?? ""].filter(s => !!s);
            this.updateItem({ selectors: newValue });
        });

        html.querySelector("[data-action=toggle-predicate]")?.addEventListener("click", () => {
            const predicate = this.rule.predicate;
            const newValue = Array.isArray(predicate)
                ? { and: predicate.length ? predicate : [] }
                : predicate?.["and"]?.length ? predicate["and"] : [];
            this.updateItem({ predicate: newValue });
        });
    }

    /** @override */
    _updateObject(formData) {
        if (Array.isArray(formData.selectors)) {
            formData.selectors = formData.selectors.map(s => s.value).filter(s => !!s);
        }

        if (Array.isArray(formData.predicate) && formData.predicate.every(p => !!p.value)) {
            formData.predicate = formData.predicate.map(s => s.value).filter(s => !!s);
        }

        if (formData.percent !== undefined) {
            formData.percent = Number(formData.percent) || 0;
        }
    }
}

export { HealOnDamageDealtForm };
