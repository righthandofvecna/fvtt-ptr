export async function applyRest(hours, pokemonCenter) {
  const isExtendedRest = hours >= 4;

  const actorUpdates = [];
  const itemDeletions = new Map();
  const itemUpdates = [];

  for (const actor of game.actors.values()) {
    const actorUpdate = { _id: actor.id };
    let healedAtCenter = false;

    // Scene Uses Reset (Always)
    for (const item of actor.items.values()) {
      if (item.system.frequency?.type === "scene") {
        itemUpdates.push({ _id: item.id, "flags.ptu.used": 0 });
      }
    }

    if (pokemonCenter) {
      const injuries = Math.max(actor.system.health.injuries ?? 0, 0);
      const requiredHours = injuries < 5 ? (2 + injuries) / 2 : 1 + injuries;

      if (requiredHours <= hours) {
        healedAtCenter = true;
        actorUpdate["system.health.value"] = actor.system.health.total;

        const conditionsToDelete = actor.items.filter(i => i.type === "condition" && !i.isGranted).map(i => i.id);
        if (conditionsToDelete.length > 0) {
          if (!itemDeletions.has(actor.id)) itemDeletions.set(actor.id, []);
          itemDeletions.get(actor.id).push(...conditionsToDelete);
        }

        for (const item of actor.items.values()) {
          if (item.system.frequency?.type === "daily") {
            itemUpdates.push({ _id: item.id, "flags.ptu.used": 0 });
          }
        }
      }
    }

    // Natural Healing (if not healed at center)
    if (!healedAtCenter) {
      if ((actor.system.health.injuries ?? 0) < 5) {
        const healAmount = hours * 2 * Math.ceil(actor.system.health.max / 16);
        if (healAmount > 0) {
          const currentHP = actor.system.health.value;
          const maxHP = actor.system.health.max;
          actorUpdate["system.health.value"] = Math.min(currentHP + healAmount, maxHP);
        }
      }
    }

    if (isExtendedRest) {
      // Persistent Conditions
      const persistentConditions = actor.items.filter(i => i.type === "condition" && !i.isGranted && i.persistent).map(i => i.id);
      if (persistentConditions.length > 0) {
        if (!itemDeletions.has(actor.id)) itemDeletions.set(actor.id, []);
        itemDeletions.get(actor.id).push(...persistentConditions);
      }

      // Trainer AP Restore
      if (actor.type === "character") {
        actorUpdate["system.ap.value"] = actor.system.ap.max;
      }

      // Daily Uses
      for (const item of actor.items.values()) {
        if (["daily", "scene"].includes(item.system.frequency?.type)) {
          const existingUpdate = itemUpdates.find(u => u._id === item.id);
          if (existingUpdate) {
            existingUpdate["flags.ptu.used"] = 0;
          } else {
            itemUpdates.push({ _id: item.id, "flags.ptu.used": 0 });
          }
        }
      }
    }

    if (Object.keys(actorUpdate).length > 1) {
      actorUpdates.push(actorUpdate);
    }
  }

  if (actorUpdates.length > 0) await Actor.updateDocuments(actorUpdates);
  for (const [actorId, itemIds] of itemDeletions.entries()) {
    const actor = game.actors.get(actorId);
    if (actor) await actor.deleteEmbeddedDocuments("Item", [...new Set(itemIds)]);
  }
  if (itemUpdates.length > 0) {
    const updatesByActor = itemUpdates.reduce((acc, update) => {
      const item = game.items.get(update._id);
      if (item && item.actor) {
        if (!acc[item.actor.id]) acc[item.actor.id] = [];
        acc[item.actor.id].push(update);
      }
      return acc;
    }, {});

    for (const actorId in updatesByActor) {
      const actor = game.actors.get(actorId);
      if (actor) await actor.updateEmbeddedDocuments("Item", updatesByActor[actorId]);
    }
  }
}