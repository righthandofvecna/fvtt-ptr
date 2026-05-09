import { RuleElementForm } from './base.js';

class TypeOverwriteForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/type-overwrite.hbs";
    }

    /** @override */
    async getData() {
        const data = await super.getData();
        const valueIsArray = Array.isArray(this.rule.value);
        const types = Object.keys(CONFIG.PTU.data.typeEffectiveness ?? {});

        return {
            ...data,
            valueIsArray,
            types,
        };
    }

    /** @override */
    activateListeners(html) {
        html.querySelector("[data-action=toggle-value]")?.addEventListener("click", () => {
            const value = this.rule.value;
            const newValue = Array.isArray(value)
                ? (value.at(0) ?? "")
                : [value ?? ""].filter((v) => !!v);
            this.updateItem({ value: newValue });
        });
    }

    /** @override */
    _updateObject(formData) {
        // Tagify sends array of {value: "..."} objects for the multiple mode
        if (Array.isArray(formData.value) && formData.value.every((v) => v?.value !== undefined)) {
            formData.value = formData.value.map((v) => v.value).filter((v) => !!v);
        }

        if (!formData.value || (Array.isArray(formData.value) && !formData.value.length)) {
            delete formData.value;
        }

        // overwrite defaults to false; delete it when false to keep data lean
        if (!formData.overwrite) delete formData.overwrite;
    }
}

export { TypeOverwriteForm };
