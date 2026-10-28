

async function onSceneEnd() {
  const updates = []
  for (const actor of game.actors.values()) {
    updates.push(actor.onSceneEnd());
  }
  await Promise.all(updates);
  game.ptu.tokenPanel?.refresh?.();
  ui.notifications.info("Scene Completed for all actors.");
}

async function onDayEnd() {
  const updates = []
  for (const actor of game.actors.values()) {
    updates.push(actor.onDayEnd());
  }
  await Promise.all(updates);
  game.ptu.tokenPanel?.refresh?.();
  ui.notifications.info("Day Completed for all actors.");
}

export const AutoRecovery = {
  listen() {
    // Create the lifecycle functions for auto-recovery
    Hooks.on("init", ()=>{
      game.ptu.lifecycle = {
        onSceneEnd,
        onDayEnd,
      }

      game.settings.register("ptu", "gmEndOfDayLastAlive", {
        name: "Last Alive at End of Day",
        hint: "The last time the GM was active within the heartbeat window after End of Day recovery was triggered (in server time).",
        scope: "world",
        config: false,
        type: Number,
        default: 0
      });
    });

    Hooks.on("ptu.sceneEnd", async ()=>{
      if (!game.user.isActiveGM) return;
      const autoRecovery = game.settings.get("ptu", "automation.autoRecovery")
      if (autoRecovery === "none") return;
      const confirmed = autoRecovery === "auto" || await foundry.applications.api.DialogV2.confirm({
          window: { title: "End Scene?" },
          content: "<p>End the scene for all actors, triggering end-of-scene recovery?</p>",
          rejectClose: false,
      });
      if (!confirmed) return;
      await game.ptu.lifecycle.onSceneEnd();
    });

    Hooks.on("ptu.dayEnd", async ()=>{
      if (!game.user.isActiveGM) return;
      const autoRecovery = game.settings.get("ptu", "automation.autoRecovery")
      if (autoRecovery === "none") return;
      const confirmed = autoRecovery === "auto" || await foundry.applications.api.DialogV2.confirm({
          window: { title: "End Day?" },
          content: "<p>Switch to a new day for all actors, triggering end-of-day recovery?</p>",
          rejectClose: false,
      });
      if (!confirmed) return;
      await game.ptu.lifecycle.onDayEnd();
    });


    //
    // Triggers for ptu.sceneEnd and ptu.dayEnd
    //
    
    // Combat End should trigger end-of-scene recovery if applicable
    Hooks.on("deleteCombat", async ()=>{
      Hooks.callAll("ptu.sceneEnd");
    });

    // Switching the active scene should trigger end-of-scene recovery if applicable
    Hooks.on("updateScene", async (scene, changes)=>{
      if (!changes.active) return;
      Hooks.callAll("ptu.sceneEnd");
    });

    // Day Start/End

    let eodSessionCheckTriggered = false;
    const triggerDayEndSession = () => {
      Hooks.off("userConnected", userConnectedHook);
      Hooks.off("ready", readyHook);
      if (deletedCombatHook) Hooks.off("deleteCombat", deletedCombatHook);
      if (eodSessionCheckTriggered) return;
      eodSessionCheckTriggered = true;
      game.settings.set("ptu", "gmEndOfDayLastAlive", game.time.serverTime);
      if (!game.settings.get("ptu", "variant.useSessionBasedRecovery")) return;
      Hooks.callAll("ptu.dayEnd");
    }

    // deferral function for handling end-of-day recovery after all combats are deleted
    let deletedCombatHook;
    const checkAfterCombatDeletion = ()=>{
      if (deletedCombatHook) return;
      deletedCombatHook = Hooks.on("deleteCombat", ()=>{
        if (game.users.contents.every(u => u.active) && !game.combats.contents.some(c=>c.active)) {
          triggerDayEndSession();
        }
      });
    };

    // Connected Users Hook
    const userConnectedHook = Hooks.on("userConnected", (user, connected)=>{
      if (!connected) return;
      // if all users are connected and there are no in-progress combats, trigger end-of-day recovery
      const allConnected = game.users.contents.every(u => u.active);
      const noCombat = !game.combats.contents.some(c=>c.active);
      if (allConnected && noCombat) {
        triggerDayEndSession();
      }
      if (allConnected && !noCombat) {
        checkAfterCombatDeletion();
      }
    });

    // Ready Hook
    const readyHook = Hooks.once("ready", ()=>{
      // Heartbeat update, so that we don't do end-of-day checks too often (every time the GM reloads, for instance)
      const HEARTBEAT_INTERVAL = 15 * 60 * 1000; // 15 minutes

      eodSessionCheckTriggered ||= game.settings.get("ptu", "gmEndOfDayLastAlive") >= (game.time.serverTime - HEARTBEAT_INTERVAL * 2);

      if (!eodSessionCheckTriggered && game.users.contents.every(u => u.active) && !game.combats.contents.some(c=>c.active)) {
        triggerDayEndSession();
      }

      if (game.user.isGM) {
        if (eodSessionCheckTriggered) game.settings.set("ptu", "gmEndOfDayLastAlive", game.time.serverTime);
        setInterval(()=>{
          if (game.user.isActiveGM && eodSessionCheckTriggered) {
            game.settings.set("ptu", "gmEndOfDayLastAlive", game.time.serverTime);
          }
        }, HEARTBEAT_INTERVAL);
      }
    });
  }
}