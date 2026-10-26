import { PTUItem } from '../index.js';

class PTUPokeEdge extends PTUItem {

  prepareBaseData() {
    super.prepareBaseData();
    this.system.tutorSlotCost ??= 1;
  }
}

export { PTUPokeEdge }