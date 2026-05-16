import { RuleElementForm } from './index.js';

class GrantItemForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/grant-item.hbs";
    }

    /** @override */
    async getData() {
        const data = await super.getData();
        const uuid = this.rule.uuid ? String(this.rule.uuid) : null;
        const granted = uuid ? await fromUuid(uuid) : null;

        if (this.rule.predicate === undefined) this.updateItem({ predicate: [] })

        return {
            ...data, 
            granted, 
            allowduplicate: !!this.rule.allowduplicate ?? true,
            predicationIsMultiple: Array.isArray(this.rule.predicate) && this.rule.predicate.every(p => typeof p === "string")
        };
    }

    /** @override */
    async activateListeners(html) {
        // Add events for toggle buttons
        html.querySelector("[data-action=toggle-predicate]")?.addEventListener("click", () => {
            const predicate = this.rule.predicate;
            const newValue = Array.isArray(predicate) ? {"and": predicate.length ? predicate : []} : predicate?.["and"]?.length ? predicate["and"] : [];
            this.updateItem({ predicate: newValue });
        });

        html.querySelector("[data-action=modification-add]")?.addEventListener("click", () => {
            const modifications = [...(this.rule.modifications ?? []), { key: "", operation: "override", value: "" }];
            this.updateItem({ modifications });
        });

        for (const btn of html.querySelectorAll("[data-action=modification-delete]")) {
            btn.addEventListener("click", (event) => {
                const idx = Number(event.target.closest("[data-idx]")?.dataset.idx);
                const modifications = [...(this.rule.modifications ?? [])];
                modifications.splice(idx, 1);
                this.updateItem({ modifications });
            });
        }
    }

    /** @override */
    _updateObject(formData) {
        if (typeof formData.uuid === "string") {
            formData.uuid = formData.uuid.trim();
            if (formData.uuid === "") delete formData.uuid;
        }

        // Optional but defaults to false
        if (!formData.replaceSelf) delete formData.replaceSelf;
        if (!formData.reevaluateOnUpdate) delete formData.reevaluateOnUpdate;

        // Optional but defaults to true
        if (formData.allowduplicate) delete formData.allowduplicate;

        if(Array.isArray(formData.predicate) && formData.predicate.every(p => !!p.value)) {
            formData.predicate = formData.predicate.map(s => s.value).filter(s => !!s)
        }

        // Normalize modifications: Foundry serialises nested inputs as an object keyed by index
        if (formData.modifications && !Array.isArray(formData.modifications)) {
            formData.modifications = Object.values(formData.modifications);
        }
        // if (Array.isArray(formData.modifications)) {
        //     formData.modifications = formData.modifications.filter(m => m?.key?.trim());
        // }
    }
}

export { GrantItemForm }