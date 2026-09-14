import { Weather } from "../../module/apps/weather.js";

export const WeatherHooks = {
    listen() {
        // Debounce to prevent concurrent calls when multiple hooks fire in quick succession
        const applyDebounced = foundry.utils.debounce(() => Weather.applyWeatherEffectsToActors(), 150);

        // Apply weather effects when a token is added to the active scene
        Hooks.on("createToken", (_tokenDoc, _options, _userId) => {
            if (!game.user.isGM) return;
            applyDebounced();
        });

        // Re-apply weather effects when a token is removed from the active scene
        Hooks.on("deleteToken", (_tokenDoc, _options, _userId) => {
            if (!game.user.isGM) return;
            applyDebounced();
        });

        // Re-apply weather effects when an actor's alliance/disposition changes
        Hooks.on("updateActor", (_actor, changes, _options, _userId) => {
            if (!game.user.isGM) return;
            if (!foundry.utils.hasProperty(changes, "system.alliance")) return;
            applyDebounced();
        });

        // Re-apply weather effects when the active scene changes
        // updateScene fires twice (old scene active:false, new scene active:true) — only react to activation
        Hooks.on("updateScene", (_scene, changes, _options, _userId) => {
            if (!game.user.isGM) return;
            if (!changes.active) return;
            applyDebounced();
        });

        // On game ready, sync weather items to reflect the current scene state
        Hooks.once("ready", () => {
            if (!game.user.isGM) return;
            Weather.applyWeatherEffectsToActors();
        });
    }
};
