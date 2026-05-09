export const HomebrewConfigSettings = {
  listen: () => {
    Hooks.on('init', (app, html, data) => {
      if (!game.settings.get("ptu", "homebrew.sceneDailyEOT")) {
        CONFIG.PTU.data.frequencies.scene.eot = false;
        CONFIG.PTU.data.frequencies.daily.eot = false;
      }
    })
  },
};