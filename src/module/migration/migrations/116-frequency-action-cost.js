import { MigrationBase } from "../base.js";

const AFFECTED_TYPES = ["feat", "move", "ability", "contestmove", "edge", "pokeedge", "capability", "item", "spiritaction"];

/**
 * Parse a legacy frequency string (e.g. "Scene x2 - Swift Action") into the
 * new structured fields: frequency object, actionCost flags, and ap number.
 *
 * @param {string | null} str
 * @returns {{ frequency: {type: string, max: number, custom: string}, actionCost: {standard: boolean, rapid: boolean, shift: boolean, free: boolean, extended: boolean}, ap: number }}
 */
function parseFrequencyString(str) {
    const result = {
        frequency: { type: "at-will", max: 0, custom: "" },
        actionCost: { standard: false, rapid: false, shift: false, free: false, extended: false },
        ap: 0,
    };

    if (!str || typeof str !== "string") return result;
    
    result.frequency.custom = str;

    // Split on " - " or " – " (em dash), allowing optional surrounding spaces
    const parts = str.split(/\s*[-–]\s*/);

    for (const part of parts) {
        const trimmed = part.trim();

        // AP cost: "2 AP", "Bind 1 AP"
        const apMatch = trimmed.match(/^(?:Bind\s+)?(\d+)\s*AP$/i);
        if (apMatch) {
            result.ap = parseInt(apMatch[1], 10);
            continue;
        }

        // Frequency types
        if (/^at.?will$/i.test(trimmed)) {
            result.frequency.type = "at-will";
            continue;
        }
        if (/^static$/i.test(trimmed)) {
            result.frequency.type = "static";
            continue;
        }
        if (/^eot$/i.test(trimmed)) {
            result.frequency.type = "eot";
            continue;
        }
        const sceneMatch = trimmed.match(/^Scene(?:\s+x(\d+))?$/i);
        if (sceneMatch) {
            result.frequency.type = "scene";
            result.frequency.max = sceneMatch[1] ? parseInt(sceneMatch[1], 10) : 1;
            continue;
        }
        const dailyMatch = trimmed.match(/^Daily(?:\s+x(\d+))?$/i);
        if (dailyMatch) {
            result.frequency.type = "daily";
            result.frequency.max = dailyMatch[1] ? parseInt(dailyMatch[1], 10) : 1;
            continue;
        }

        // Action cost flags ("Rapid Action" and "Swift Action" both map to swift)
        if (/standard\s+action/i.test(trimmed)) result.actionCost.standard = true;
        if (/(?:swift|rapid)\s+action/i.test(trimmed)) result.actionCost.rapid = true;
        if (/\b(?:move|shift)\s+action/i.test(trimmed)) result.actionCost.shift = true;
        if (/free\s+action/i.test(trimmed)) result.actionCost.free = true;
        if (/extended\s+action/i.test(trimmed)) result.actionCost.extended = true;
    }

    // if no action cost flags were set and the type isn't Static, default to standard action
    if (!result.actionCost.standard &&
        !result.actionCost.rapid &&
        !result.actionCost.shift &&
        !result.actionCost.free &&
        !result.actionCost.extended &&
        result.frequency.type !== "static") {
        result.actionCost.standard = true;
    }

    return result;
}

export class Migration116FrequencyActionCost extends MigrationBase {
    static version = 0.116;

    /**
     * @type {MigrationBase['updateItem']}
     */
    async updateItem(item) {
        if (!AFFECTED_TYPES.includes(item.type)) return;

        // Only migrate if frequency is still a legacy string
        if (typeof item.system.frequency !== "string") return;

        const parsed = parseFrequencyString(item.system.frequency);
        item.system.frequency = parsed.frequency;
        item.system.actionCost = parsed.actionCost;
        item.system.ap = parsed.ap;
    }
}
