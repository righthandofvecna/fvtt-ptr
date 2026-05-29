const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

export class GMControlPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "ptu-gm-control-panel",
    classes: ["ptu", "gm-control-panel"],
    position: {
      width: 300,
    },
    window: {
      title: "GM Controls",
      minimizable: true,
      resizable: false,
    },
    actions: {
      resetSceneUses: GMControlPanel.#resetSceneUses,
      resetDailyUses: GMControlPanel.#resetDailyUses,
      resetCustomFrequencyUses: GMControlPanel.#resetCustomFrequencyUses,
      healAllActors: GMControlPanel.#healAllActors,
    },
  };

  static PARTS = {
    content: {
      template: "systems/ptu/static/templates/apps/gm-control-panel.hbs",
    },
  };

  /** @override */
  async _prepareContext(_options) {
    return {};
  }

  static async #resetSceneUses() {
    const updates = [];
    for (const actor of game.actors.values()) {
      for (const item of actor.items.values()) {
        if (item.system.frequency?.type !== "scene") continue;
        const max = item.system.frequency?.max ?? 0;
        if (!max) continue;
        updates.push(item.setFlag("ptu", "used", 0));
      }
    }
    await Promise.all(updates);
    game.ptu.tokenPanel?.refresh?.();
    ui.notifications.info("Scene uses reset for all actors.");
  }

  static async #resetDailyUses() {
    const updates = [];
    for (const actor of game.actors.values()) {
      for (const item of actor.items.values()) {
        if (!["daily", "scene"].includes(item.system.frequency?.type)) continue;
        const max = item.system.frequency?.max ?? 0;
        if (!max) continue;
        updates.push(item.setFlag("ptu", "used", 0));
      }
    }
    await Promise.all(updates);
    game.ptu.tokenPanel?.refresh?.();
    ui.notifications.info("Daily uses reset for all actors.");
  }

  static async #resetCustomFrequencyUses() {
    const updates = [];
    for (const actor of game.actors.values()) {
      for (const item of actor.items.values()) {
        if (item.system.frequency?.type !== "custom") continue;
        const max = item.system.frequency?.max ?? 0;
        if (!max) continue;
        updates.push(item.setFlag("ptu", "used", 0));
      }
    }
    await Promise.all(updates);
    game.ptu.tokenPanel?.refresh?.();
    ui.notifications.info("Custom frequency uses reset for all actors.");
  }

  static async #healAllActors() {
    const confirmed = await DialogV2.confirm({
      window: { title: "Heal All Actors" },
      content: "<p>Restore <em>all actors</em> to full health, reduce injuries by 3, and remove all conditions?</p>",
      rejectClose: false,
    });
    if (!confirmed) return;

    const actorUpdates = [];
    for (const actor of game.actors.values()) {
      if (!actor) continue;
      // delete effects first so things reducing max HP don't stick around
      await actor.deleteEmbeddedDocuments(
        "Item",
        actor.items.filter(i => i.type === "condition" && !i.isGranted).map(i => i.id)
      );
      actorUpdates.push({
        _id: actor.id,
        "system.health.value": actor.system.health.total,
        "system.health.injuries": Math.max(0, (actor.system.health.injuries ?? 0) - 3),
      });
    }
    if (actorUpdates.length > 0) {
      await Actor.updateDocuments(actorUpdates);
    }
    game.ptu.tokenPanel?.refresh?.();
    ui.notifications.info(`Healed ${actorUpdates.length} actor(s).`);
  }
}
