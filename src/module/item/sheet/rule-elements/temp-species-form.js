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

        return {
            ...data,
            species,
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
