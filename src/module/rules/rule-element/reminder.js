import { RuleElementPTU } from "./base.js";
import { PTUPredicate } from "../../system/index.js";
import { PredicateField } from "../../system/schema-data-fields.js";

/**
 * Reminder rule element
 * Registers reminder constructors onto actor.synthetics.reminders so the runtime can create
 * private chat messages to owners when selectors trigger.
 */
class ReminderRuleElement extends RuleElementPTU {
    constructor(source, item, options = {}) {
        const messagePredicate = source.messagePredicate ?? undefined;
        if(!(messagePredicate instanceof PTUPredicate)) {
            if(messagePredicate === undefined || messagePredicate.length === 0) {
                source.messagePredicate = new PTUPredicate();
                console.log("PTU | No message predicate provided for reminder, defaulting to always-true predicate", { source });
            } 
            else {
                console.log("PTU | Constructing message predicate for reminder", { source, messagePredicate });
                if(Array.isArray(messagePredicate)) {
                    source.messagePredicate = new PTUPredicate(...messagePredicate);
                }
                else {
                    source.messagePredicate = new PTUPredicate(messagePredicate);
                }
            }
            
        }
        super(source, item, options);
    }

    /** @override */
    static defineSchema() {
        const { fields } = foundry.data;

        return {
            ...super.defineSchema(),
            selectors: new fields.ArrayField(
                new fields.StringField({ required: true, blank: false, initial: undefined })
            ),
            affects: new fields.StringField({ required: true, choices: ["origin", "target"], initial: "origin" }),
            message: new fields.StringField({ required: true, nullable: false, blank: false, initial: "{actor|name}: {item|name} can be used." }),
            frequency: new fields.StringField({ required: false, nullable: true, initial: "always" }),
            messagePredicate: new PredicateField(),
        };
    }

    /** @override */
    beforePrepareData() {
        if (this.ignored) return;

        const selectors = (this.selectors ?? []).map(s => this.resolveInjectedProperties(s)).filter(s => !!s);
        if (selectors.length === 0) return this.failValidation("must have at least one selector");

        // Stable ID for mute-map keys; computed once, shared across all selector buckets.
        const reminderId = `${this.actor.uuid}:${this.item.uuid}:${this.sourceIndex ?? 0}`;

        for (const selector of selectors) {
            const construct = async (options = {}) => {
                console.log("PTU | Constructing reminder with options", { self: this, options, predicate: this.messagePredicate, test: this.resolveInjectedProperties(this.messagePredicate).test(options.test) }); // Debug log
                if (!this.test()) return null;
                if (!this.resolveInjectedProperties(this.messagePredicate).test(options.test ?? this.actor.getRollOptions())) return null;

                // Enforce frequency / mute
                if (this.frequency !== "always") {
                    const mutedMap = this.actor.getFlag?.("ptu", "mutedReminders") ?? {};
                    const muteEntry = mutedMap[reminderId];
                    if (muteEntry) {
                        if (this.frequency === "once-per-combat" && muteEntry.combatId === (game.combat?.id ?? null)) return null;
                        if (this.frequency === "once-per-rest") return null;
                    }
                }

                const content = this.resolveInjectedProperties(this.message);
                if (!content) return null;

                const speaker = ChatMessage.getSpeaker({ actor: this.actor, token: this.token });
                const recipients = game.users.filter((u) => this.actor.testUserPermission(u, "OWNER")).map((u) => u.id);

                return {
                    content,
                    speaker,
                    whisper: recipients,
                    flags: { ptu: { reminder: { actor: this.actor?.uuid, item: this.item?.uuid, ruleKey: this.key, sourceIndex: this.sourceIndex, id: reminderId } } },
                };
            };

            const synthetics = (this.actor.synthetics.reminders ??= {});
            const bucket = (synthetics[selector] ??= { target: {}, origin: {} });
            bucket[this.affects][reminderId] = construct;
        }
    }
}

export { ReminderRuleElement };
