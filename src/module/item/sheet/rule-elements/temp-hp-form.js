import { RuleElementForm } from './base.js';

class TempHPForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/temp-hp.hbs";
    }

    /** @override */
    async getData() {
        const data = await super.getData();
        return {
            ...data,
            removeOnDelete: this.rule.removeOnDelete !== false,
        };
    }

    /** @override */
    _updateObject(formData) {
        formData.value = this.coerceNumber(formData.value ?? "");
        if (typeof formData.value !== "number") delete formData.value;

        // removeOnDelete defaults to true; only save it explicitly when false
        if (formData.removeOnDelete !== false) delete formData.removeOnDelete;
    }
}

export { TempHPForm };
