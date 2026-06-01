import { MigrationBase } from "../base.js";

export class Migration119XpPoolFlatten extends MigrationBase {
    static version = 0.119;

    async updateActor(source) {
        if (source.type !== "character") return;
        const xpPool = source.system?.level?.xpPool;
        try {
            if (typeof xpPool === "string") {
                source.system.level.xpPool = parseInt(xpPool);
                return;
            }
            if (Array.isArray(xpPool)) {
                source.system.level.xpPool = xpPool.reduce((a, b) => a + parseInt(b), 0);
            }
        } catch (e) {
            console.error(`Error flattening xpPool for actor ${source.name} (${source.id}):`, e);
        }
    }
}
