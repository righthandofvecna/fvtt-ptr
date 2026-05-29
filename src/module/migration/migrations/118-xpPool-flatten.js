import { MigrationBase } from "../base.js";

export class Migration118XpPoolFlatten extends MigrationBase {
    static version = 0.118;

    async updateActor(source) {
        if (source.type !== "character") return;
        const xpPool = source.system?.level?.xpPool;
        if (!Array.isArray(xpPool)) return;
        source.system.level.xpPool = xpPool.reduce((a, b) => a + b, 0);
    }
}
