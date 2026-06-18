import { RuleElementForm } from './base.js';

class TempSpeciesForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/temp-species.hbs";
    }

    /** @override */
    async getData() {
        const data = await super.getData();
        const uuid = this.rule.uuid ? String(this.rule.uuid) : null;
        const species = uuid ? await fromUuid(uuid) : null;

        if(this.rule.predicate === undefined) this.updateItem({predicate: []})

        return {
            ...data,
            species,
            predicationIsMultiple: Array.isArray(this.rule.predicate) && this.rule.predicate.every(p => typeof p === "string"),
        };
    }

    /** @override */
    activateListeners(html) {
        // Drag-and-drop a Pokemon actor onto the UUID field
        const dropZone = html.querySelector("[data-action=uuid-drop]");
        if (dropZone) {
            dropZone.addEventListener("dragover", (event) => {
                event.preventDefault();
                event.stopPropagation();
            });
            dropZone.addEventListener("drop", (event) => {
                event.preventDefault();
                event.stopPropagation();
                try {
                    const dropData = JSON.parse(event.dataTransfer.getData("text/plain"));
                    if (dropData.type !== "Actor") return;
                    const uuid = dropData.uuid;
                    if (!uuid) return;
                    this.updateItem({ uuid });
                } catch (err) {
                    console.error("PTU | TempSpeciesForm | Drop error", err);
                }
            });
        }

        // Add events for toggle buttons
        html.querySelector("[data-action=toggle-predicate]")?.addEventListener("click", () => {
            const predicate = this.rule.predicate;
            const newValue = Array.isArray(predicate) ? {"and": predicate.length ? predicate : []} : predicate?.["and"]?.length ? predicate["and"] : [];
            this.updateItem({ predicate: newValue });
        });
    }

    /** @override */
    _updateObject(formData) {
        if (typeof formData.uuid === "string") {
            formData.uuid = formData.uuid.trim();
            if (!formData.uuid) delete formData.uuid;
        }
    }
}

export { TempSpeciesForm };
