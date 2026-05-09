import { RuleElementForm } from './base.js';

class TokenLightForm extends RuleElementForm {
    /** @override */
    get template() {
        return "systems/ptu/static/templates/item/rules/token-light.hbs";
    }

    /** @override */
    async getData() {
        const data = await super.getData();
        const v = this.rule.value ?? {};
        const animation = v.animation ?? {};

        return {
            ...data,
            lightValue: {
                dim: v.dim ?? "",
                bright: v.bright ?? "",
                angle: v.angle ?? "",
                color: v.color ?? "",
                alpha: v.alpha ?? "",
                animation: {
                    type: animation.type ?? "",
                    speed: animation.speed ?? "",
                    intensity: animation.intensity ?? "",
                    reverse: animation.reverse ?? false,
                },
            },
        };
    }

    /** @override */
    _updateObject(formData) {
        if (!formData.value || typeof formData.value !== "object") formData.value = {};

        // Coerce numeric top-level light fields
        for (const key of ["dim", "bright", "angle", "alpha"]) {
            const coerced = this.coerceNumber(formData.value[key] ?? "");
            if (typeof coerced === "number") {
                formData.value[key] = coerced;
            } else {
                delete formData.value[key];
            }
        }

        // Clean up color
        if (!formData.value.color) delete formData.value.color;

        // Handle animation sub-object
        const anim = formData.value.animation;
        if (anim && typeof anim === "object") {
            if (!anim.type) {
                delete formData.value.animation;
            } else {
                for (const key of ["speed", "intensity"]) {
                    const coerced = this.coerceNumber(anim[key] ?? "");
                    if (typeof coerced === "number") {
                        anim[key] = coerced;
                    } else {
                        delete anim[key];
                    }
                }
                if (!anim.reverse) delete anim.reverse;
            }
        }

        // If value ended up empty, remove it entirely
        if (!Object.keys(formData.value).length) delete formData.value;
    }
}

export { TokenLightForm };
