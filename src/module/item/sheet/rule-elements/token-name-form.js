import { RuleElementForm } from './base.js';

class TokenNameForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/token-name.hbs";
    }

    /** @override */
    _updateObject(formData) {
        if (!formData.value) delete formData.value;
    }
}

export { TokenNameForm };
