export const HomebrewConfigSettings = {
  listen: () => {
    Hooks.on('init', (app, html, data) => {
      if (!game.settings.get("ptu", "homebrew.sceneDailyEOT")) {
        CONFIG.PTU.frequencies.scene.eot = false;
        CONFIG.PTU.frequencies.daily.eot = false;
      }
    })
  },
};