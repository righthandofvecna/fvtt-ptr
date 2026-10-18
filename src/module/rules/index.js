import { RuleElementPTU } from "./rule-element/base.js";
import { AELikeRuleElement } from "./rule-element/ae-like.js";
import { InstantChangeRuleElement } from "./rule-element/instant-change.js";
import { GrantItemRuleElement } from "./rule-element/grant-item/rule-element.js";
import { RollOptionRuleElement } from "./rule-element/roll-option.js";
import { ChoiceSetRuleElement } from "./rule-element/choice-set/rule-element.js";
import { FlatModifierRuleElement } from "./rule-element/flat-modifier.js";
import { TokenImageRuleElement } from "./rule-element/token-image.js";
import { TemporarySpeciesRuleElement } from "./rule-element/temp-species.js";
import { TokenNameRuleElement } from "./rule-element/token-name.js";
import { TokenLightRuleElement } from "./rule-element/token-light.js";
import { TypeOverwriteRuleElement } from "./rule-element/type-overwrite.js";
import { TempHPRuleElement } from "./rule-element/temp-hp.js";
import { EffectivenessRuleElement } from "./rule-element/effectiveness.js";
import { EphemeralEffectRuleElement } from "./rule-element/ephemeral-effect.js";
import { ActionPointsRuleElement } from "./rule-element/ap.js";
import { ApplyEffectRuleElement } from "./rule-element/apply-effect.js";
import { ReminderRuleElement } from "./rule-element/reminder.js";
import { HealOnDamageDealtRuleElement } from "./rule-element/heal-on-damage-dealt.js";

class RuleElements {
    static builtin = {
        "ActiveEffectLike": AELikeRuleElement,
        "GrantItem": GrantItemRuleElement,
        "RollOption": RollOptionRuleElement,
        "ChoiceSet": ChoiceSetRuleElement,
        "FlatModifier": FlatModifierRuleElement,
        "TokenImage": TokenImageRuleElement,
        "TokenName": TokenNameRuleElement,
        "TokenLight": TokenLightRuleElement,
        "TemporarySpecies": TemporarySpeciesRuleElement,
        "TypeOverwrite": TypeOverwriteRuleElement,
        "TempHP": TempHPRuleElement,
        "Effectiveness": EffectivenessRuleElement,
        "EphemeralEffect": EphemeralEffectRuleElement,
        "ActionPoint": ActionPointsRuleElement,
        "ApplyEffect": ApplyEffectRuleElement,
        "Reminder": ReminderRuleElement,
        "HealOnDamageDealt": HealOnDamageDealtRuleElement,
        "InstantChange": InstantChangeRuleElement,
    }

    static custom = {}

    static get all() {
        return {...RuleElements.builtin, ...RuleElements.custom};
    }
    
    static getRuleElementDocument(key) {
        return RuleElements.custom[key] ?? RuleElements.builtin[key];
    }

    static fromSource(source, item, options = {}) {
        source = foundry.utils.deepClone(source);
        const RuleElementDocument = RuleElements.getRuleElementDocument(source.key);
        if (!RuleElementDocument) {
            console.warn(`PTU | RuleElements | Unrecognized rule element: ${source.key} on item ${item.name} (${item.uuid})`);
            return null;
        }

        try {
            return new RuleElementDocument(source, item, options);
        } catch (error) {
            if (!options.suppressWarnings) {
                console.warn(`PTU | RuleElements | Error creating rule element: ${source.key} on item ${item.name} (${item.uuid})`, error);
            }
            return null;
        }
    }

    static fromOwnedItem(item, options = {}) {
        const rules = [];
        // if(!item.system.rules) throw new Error(`PTU | Item ${item.name} (${item.uuid}) does not have a rules object`);
        for(const [sourceIndex, source] of item.system.rules?.entries() ?? [].entries()) {
            if (typeof source.key !== "string") {
                console.error(`PTU | RuleElements | Invalid rule key: ${source.key} on item ${item.name} (${item.uuid})`);
                continue;
            }
            const rule = RuleElements.fromSource(source, item, {...(options ?? {}), sourceIndex});
            if(rule) rules.push(rule);
        }
        return rules;
    }
}

export { RuleElements, RuleElementPTU }