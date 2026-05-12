import { RuleElementForm } from './base.js';

class ActionPointForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/action-point.hbs";
    }

    /** @override */
    _updateObject(formData) {
        const drained = this.coerceNumber(formData.drainedValue ?? "");
        formData.drainedValue = typeof drained === "number" ? drained : 0;

        const bound = this.coerceNumber(formData.boundValue ?? "");
        formData.boundValue = typeof bound === "number" ? bound : 0;
    }
}

export { ActionPointForm };
