import { AELikeForm } from "./ae-like-form.js"
import { ActionPointForm } from "./action-point-form.js"
import { ApplyEffectForm } from "./apply-effect-form.js"
import { ChoiceSetForm } from "./choice-set-form.js"
import { RuleElementForm } from "./base.js"
import { EffectivenessForm } from "./effectiveness-form.js"
import { EphemeralEffectForm } from "./ephemeral-effect-form.js"
import { FlatModifierForm } from "./flat-modifier-form.js"
import { GrantItemForm } from "./grant-item-form.js"
import { HealOnDamageDealtForm } from "./heal-on-damage-dealt-form.js"
import { RollOptionForm } from "./roll-option-form.js"
import { ReminderForm } from "./reminder-form.js"
import { TempHPForm } from "./temp-hp-form.js"
import { TempSpeciesForm } from "./temp-species-form.js"
import { TokenImageForm } from "./token-image-form.js"
import { TokenLightForm } from "./token-light-form.js"
import { TokenNameForm } from "./token-name-form.js"
import { TypeOverwriteForm } from "./type-overwrite-form.js"

const RULE_ELEMENT_FORMS = {
    GrantItem: GrantItemForm,
    FlatModifier: FlatModifierForm,
    RollOption: RollOptionForm,
    ActiveEffectLike: AELikeForm,
    ChoiceSet: ChoiceSetForm,
    Effectiveness: EffectivenessForm,
    EphemeralEffect: EphemeralEffectForm,
    ApplyEffect: ApplyEffectForm,
    HealOnDamageDealt: HealOnDamageDealtForm,
    Reminder: ReminderForm,
    TempHP: TempHPForm,
    TemporarySpecies: TempSpeciesForm,
    TokenImage: TokenImageForm,
    TokenLight: TokenLightForm,
    TokenName: TokenNameForm,
    TypeOverwrite: TypeOverwriteForm,
    ActionPoint: ActionPointForm,
}

export { RULE_ELEMENT_FORMS, RuleElementForm}