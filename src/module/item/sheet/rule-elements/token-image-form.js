import { RuleElementForm } from './base.js';

class TokenImageForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/token-image.hbs";
    }

    /** @override */
    async getData() {
        const data = await super.getData();
        const value = this.rule.value;
        const previewValid =
            typeof value === "string" &&
            value.length > 0 &&
            !value.includes("{");

        return {
            ...data,
            previewValid,
            predicationIsMultiple: Array.isArray(this.rule.predicate) && this.rule.predicate.every(p => typeof p === "string"),
        };
    }

    /** @override */
    activateListeners(html) {
        // File picker button
        html.querySelector("[data-action=browse-image]")?.addEventListener("click", () => {
            new FilePicker({
                type: "image",
                callback: (path) => this.updateItem({ value: path }),
                current: this.rule.value ?? "",
            }).browse(this.rule.value ?? "");
        });

        html.querySelector("[data-action=toggle-predicate]")?.addEventListener("click", () => {
            const predicate = this.rule.predicate;
            const newValue = Array.isArray(predicate)
                ? { "and": predicate.length ? predicate : [] }
                : predicate?.["and"]?.length ? predicate["and"] : [];
            this.updateItem({ predicate: newValue });
        });

        // Drag-and-drop an image tile/asset onto the value row
        const valueRow = html.querySelector(".image-value-row");
        if (valueRow) {
            valueRow.addEventListener("dragover", (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
            valueRow.addEventListener("drop", (event) => {
                event.preventDefault();
                event.stopPropagation();
                try {
                    const dropData = JSON.parse(event.dataTransfer.getData("text/plain"));
                    const src = dropData.img ?? dropData.src ?? dropData.path ?? null;
                    if (typeof src === "string") this.updateItem({ value: src });
                } catch {
                    // Plain text (e.g., dragged file path)
                    const text = event.dataTransfer.getData("text/plain");
                    if (text && !text.startsWith("{")) this.updateItem({ value: text });
                }
            });
        }
    }

    /** @override */
    _updateObject(formData) {
        if (!formData.value) delete formData.value;

        const scale = this.coerceNumber(formData.scale ?? "");
        if (typeof scale === "number" && scale > 0) formData.scale = scale;
        else delete formData.scale;

        if (!formData.tint) delete formData.tint;

        const alpha = this.coerceNumber(formData.alpha ?? "");
        if (typeof alpha === "number") formData.alpha = alpha;
        else delete formData.alpha;
    }
}

export { TokenImageForm };
