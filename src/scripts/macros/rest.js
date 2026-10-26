export async function applyRest(hours, pokemonCenter, actors=undefined) {
  const isExtendedRest = hours >= 4;
  actors ??= [...game.actors.values()];

  const prevActorValues = actors.map(a=>foundry.utils.deepClone(a.toObject()));

  const actorUpdates = [];
  const itemDeletions = new Map();
  const itemUpdates = [];

  for (const actor of actors) {
    const actorUpdate = { _id: actor.id };
    let healedAtCenter = false;

    // Scene Uses Reset (Always)
    for (const item of actor.items.values()) {
      if (item.system.frequency?.type === "scene") {
        itemUpdates.push({ _id: item.id, "flags.ptu.used": 0 });
      }
    }

    const injuries = Math.max(actor.system.health.injuries ?? 0, 0);
    if (pokemonCenter) {
      const requiredHours = injuries < 5 ? (2 + injuries) / 2 : 1 + injuries;

      if (requiredHours <= hours) {
        healedAtCenter = true;
        actorUpdate["system.health.value"] = actor.system.health.total;
        actorUpdate["system.health.injuries"] = Math.max(0, injuries - 3);

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
      if (injuries < 5) {
        const healAmount = hours * 2 * Math.ceil(actor.system.health.max / 16);
        if (healAmount > 0) {
          const currentHP = actor.system.health.value;
          const maxHP = actor.system.health.max;
          actorUpdate["system.health.value"] = Math.min(currentHP + healAmount, maxHP);
        }
      }
    }

    // PP restoration
    actorUpdate["system.pp.value"] = Math.min(actor.system.pp.value + (hours * 8), actor.system.pp.max ?? 0);

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

  // do endOfDay calls for all actors
  if (isExtendedRest) await Promise.all(actors.map(actor => actor.onDayEnd()));

  // send the rest summary message to the chat, including a list of actors who rested, how much HP, injuries, spirit, PP, and AP were restored
  let chatMessageContent = `<p>Rest applied for ${hours} hour${(hours !== 1 ? "s" : "")}${isExtendedRest ? " (Extended Rest)" : ""}${pokemonCenter ? " at a Pokémon Center" : ""}.</p><ul>`;
  for (const actor of actors) {
    // use diff from prevActorValues
    const prevActor = prevActorValues.find(a => a._id === actor.id);
    const hpDiff = actor.system.health.value - (prevActor?.system?.health?.value ?? 0);
    const injuriesDiff = (actor.system.health.injuries ?? 0) - (prevActor?.system?.health?.injuries ?? 0);
    const spiritDiff = actor.system.spirit.value - (prevActor?.system?.spirit?.value ?? 0);
    const ppDiff = actor.system.pp.value - (prevActor?.system?.pp?.value ?? 0);
    const apDiff = actor.type === "character" ? actor.system.ap.value - (prevActor?.system?.ap?.value ?? 0) : 0;
    const deletedItems = (prevActor?.items ?? []).filter(item => !actor.items.get(item._id));
    if (hpDiff || injuriesDiff || spiritDiff || ppDiff || apDiff) {
      let qualifiedName = actor.name;
      if (actor.trainer) qualifiedName = `${actor.trainer.name}'s ${actor.name}`;
      chatMessageContent += `<li><strong>${qualifiedName}</strong><ul>`
      if (hpDiff) chatMessageContent += `<li><em>HP</em> <strong>${hpDiff > 0 ? `+${hpDiff}` : hpDiff}</strong></li>`;
      if (injuriesDiff) chatMessageContent += `<li><em>Injuries</em> <strong>${injuriesDiff > 0 ? `+${injuriesDiff}` : injuriesDiff}</strong></li>`;
      if (spiritDiff) chatMessageContent += `<li><em>Spirit</em> <strong>${spiritDiff > 0 ? `+${spiritDiff}` : spiritDiff}</strong></li>`;
      if (ppDiff) chatMessageContent += `<li><em>PP</em> <strong>${ppDiff > 0 ? `+${ppDiff}` : ppDiff}</strong></li>`;
      if (apDiff) chatMessageContent += `<li><em>AP</em> <strong>${apDiff > 0 ? `+${apDiff}` : apDiff}</strong></li>`;
      for (const item of deletedItems) {
        chatMessageContent += `<li><strong>-${item.name}</strong></li>`;
      }
      chatMessageContent += `</ul></li>`;
    }
  }
  chatMessageContent += `</ul>`;
  ChatMessage.create({ content: chatMessageContent });
}