import { DefineCustomElements } from "./define-custom-elements.js";
import { Init } from "./init.js";
import { ActorButtons } from "./actor-tab-buttons.js";
import { RenderTokenHUD } from "./render-token-hud.js";
import { DropCanvasData } from "./drop-canvas-data.js";
import { ItemPilesHooks } from "./item-piles-compatibility.js";
import { Ready } from "./ready.js";
import { DeleteToken } from "./tokenDocumentDeleted.js";
import { AutocompleteInlinePropertiesSetup } from "./aip-setup.js";
import { GetSceneControlButtons } from "./get-scene-control-buttons.js";
import { CompendiumBrowserInlineEnricher } from "./compendium-browser-inline-enricher.js";
import { TagifySheets } from "./tagify-sheets.js";
import { PokeDollarEnricher } from "./pokedollar-enricher.js";
import { RenderChatMessage } from "./render-chat-message.js";
import { TrainerPokemonSync } from "./trainer-pokemon-sync.js";
import { AdvancementPending } from "./advancement-pending.js";
import { HomebrewConfigSettings } from "./homebrew-config-settings.js";
import { GMControlPanelHook } from "./gm-control-panel.js";
import { QuickInsertCompat } from "./quick-insert-compat.js";

export const PtuHooks = {
    listen() {
        const listeners = [
            // Add your listeners here
            DefineCustomElements,
            Init,
            ActorButtons,
            RenderTokenHUD,
            DropCanvasData,
            ItemPilesHooks,
            Ready,
            DeleteToken,
            AutocompleteInlinePropertiesSetup,
            GetSceneControlButtons,
            CompendiumBrowserInlineEnricher,
            TagifySheets,
            PokeDollarEnricher,
            RenderChatMessage,
            TrainerPokemonSync,
            AdvancementPending,
            HomebrewConfigSettings,
            GMControlPanelHook,
            QuickInsertCompat,
        ]
        for(const listener of listeners) listener.listen();
    }
}