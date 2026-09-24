import { PTUItem } from '../base.js';

class PTUSpiritAction extends PTUItem {

  /** Cost in spirit points to use this action (from system.cost). */
  get spiritCost() {
    return Number(this.system.cost) || 0;
  }

  /** @override */
  async use(options = {}) {
    if (!this.actor) return;

    const cost = this.spiritCost;
    if (cost > 0) {
      const current = this.actor.system.spirit?.value ?? 0;
      await this.actor.update({ "system.spirit.value": current - cost });
    }

    await super.use(options);
  }
}

export { PTUSpiritAction };
