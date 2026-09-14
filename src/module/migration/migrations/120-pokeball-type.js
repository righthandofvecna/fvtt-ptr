import { MigrationBase } from "../base.js";

export class Migration120PokeballType extends MigrationBase {
    static version = 0.120;

    async updateItem(source) {
        if (source.type !== "item") return;
        if (source.system?.subtype !== "pokeball") return;

        // Convert to the dedicated pokeball type introduced alongside this migration.
        // The "subtype" field is no longer needed since the type itself identifies pokeballs.
        source.type = "pokeball";
        delete source.system.subtype;
        source.system = new foundry.data.operators.ForcedReplacement(source.system);
    }
}
