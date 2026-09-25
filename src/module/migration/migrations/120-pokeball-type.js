import { MigrationBase } from "../base.js";

export class Migration120PokeballType extends MigrationBase {
    static version = 0.120;

    async updateItem(source) {
        if (source.type !== "item") return;
        if (source.system?.subtype !== "pokeball") return;
        if (foundry.utils.isNewerVersion("14", game.version)) return; // this won't work to migrate on v13

        // Convert to the dedicated pokeball type introduced alongside this migration.
        // The "subtype" field is no longer needed since the type itself identifies pokeballs.
        source.type = "pokeball";
        delete source.system.subtype;
        source.system = new foundry.data.operators.ForcedReplacement(source.system);
    }

    async migrate() {
        if (!foundry.utils.isNewerVersion("14", game.version)) return; // this should only run on v13, where ForcedReplacement isn't available
        for (const item of game.items.contents) {
            // do a forced update
            if (item.type !== "item" || item.system?.subtype !== "pokeball") continue;
            await item.update({"type": "pokeball", "==system": foundry.utils.deepClone(item.system)});
        }
        for (const actor of game.actors.contents) {
            for (const item of actor.items.contents) {
                if (item.type !== "item" || item.system?.subtype !== "pokeball") continue;
                await item.update({"type": "pokeball", "==system": foundry.utils.deepClone(item.system)});
            }
        }
    }
}
