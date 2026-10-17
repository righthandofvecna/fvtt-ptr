export const EffectTrackerHooks = {
  listen() {
    Hooks.on("updateWorldTime", ()=>{
      game.ptu.effectTracker.refresh({ resetItemData: true });
    })
  }
}