import { PTUSettingsMenu } from "./base.js";

const GenerationSettingsConfig = {
    "defaultImageDirectory": {
        name: "PTU.Settings.Generation.DefaultImageDirectory.Name",
        hint: "PTU.Settings.Generation.DefaultImageDirectory.Hint",
        type: String,
        filePicker: true,
        default: "systems/ptu/static/images/sprites/"
    },
    "defaultImageExtension": {
        name: "PTU.Settings.Generation.DefaultImageExtension.Name",
        hint: "PTU.Settings.Generation.DefaultImageExtension.Hint",
        type: String,
        default: ".webp"
    },
    "defaultTokenImageExtension": {
        name: "PTU.Settings.Generation.DefaultTokenImageExtension.Name",
        hint: "PTU.Settings.Generation.DefaultTokenImageExtension.Hint",
        type: String,
        default: ".webp"
    },
    "defaultPokemonImageNameType": {
        name: "PTU.Settings.Generation.DefaultPokemonImageNameType.Name",
        hint: "PTU.Settings.Generation.DefaultPokemonImageNameType.Hint",
        type: Boolean,
        default: false
    },
    // These settings should be hidden, since they're auto-set
    // Drag-In Settings
    "defaultDexDragInLevelMin": {
        name: "PTU.Settings.Generation.DefaultDexDragInLevelMin.Name",
        hint: "PTU.Settings.Generation.DefaultDexDragInLevelMin.Hint",
        type: Number,
        scope: "user",
        default: 10,
        hidden: true
    },
    "defaultDexDragInLevelMax": {
        name: "PTU.Settings.Generation.DefaultDexDragInLevelMax.Name",
        hint: "PTU.Settings.Generation.DefaultDexDragInLevelMax.Hint",
        type: Number,
        scope: "user",
        default: 10,
        hidden: true
    },
    "defaultDexDragInShinyChance": {
        name: "PTU.Settings.Generation.DefaultDexDragInShinyChance.Name",
        hint: "PTU.Settings.Generation.DefaultDexDragInShinyChance.Hint",
        type: Number,
        scope: "user",
        default: 2,
        hidden: true
    },
    "defaultDexDragInStatRandomness": {
        name: "PTU.Settings.Generation.DefaultDexDragInStatRandomness.Name",
        hint: "PTU.Settings.Generation.DefaultDexDragInStatRandomness.Hint",
        type: Number,
        scope: "user",
        default: 20,
        hidden: true
    },
    "defaultDexDragInPreventEvolution": {
        name: "PTU.Settings.Generation.DefaultDexDragInPreventEvolution.Name",
        hint: "PTU.Settings.Generation.DefaultDexDragInPreventEvolution.Hint",
        type: Boolean,
        scope: "user",
        default: false,
        hidden: true
    },
    "defaultDexDragInAlphaChance": {
        name: "PTU.Settings.Generation.DefaultDexDragInAlphaChance.Name",
        hint: "PTU.Settings.Generation.DefaultDexDragInAlphaChance.Hint",
        type: Number,
        scope: "user",
        default: 0,
        hidden: true
    },
    // Mass Generator Settings
    "defaultMassGeneratorLevelMin": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorLevelMin.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorLevelMin.Hint",
        type: Number,
        scope: "user",
        default: 10,
        hidden: true
    },
    "defaultMassGeneratorLevelMax": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorLevelMax.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorLevelMax.Hint",
        type: Number,
        scope: "user",
        default: 10,
        hidden: true
    },
    "defaultMassGeneratorPreventEvolution": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorPreventEvolution.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorPreventEvolution.Hint",
        type: Boolean,
        scope: "user",
        default: false,
        hidden: true
    },
    "defaultMassGeneratorPreventEvolution": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorPreventEvolution.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorPreventEvolution.Hint",
        type: Boolean,
        scope: "user",
        default: false,
        hidden: true
    },
    "defaultMassGeneratorAlphaChance": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorAlphaChance.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorAlphaChance.Hint",
        type: Number,
        scope: "user",
        default: 0,
        hidden: true
    },
    "defaultMassGeneratorShinyChance": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorShinyChance.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorShinyChance.Hint",
        type: Number,
        scope: "user",
        default: 2,
        hidden: true
    },
    "defaultMassGeneratorAmount": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorAmount.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorAmount.Hint",
        type: Number,
        scope: "user",
        default: 20,
        hidden: true
    },
    "defaultMassGeneratorSpeciesTab": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorSpeciesTab.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorSpeciesTab.Hint",
        type: String,
        scope: "user",
        default: "species",
        hidden: true
    },
    "defaultMassGeneratorSpeciesUuid": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorSpeciesUuid.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorSpeciesUuid.Hint",
        type: String,
        scope: "user",
        default: "",
        hidden: true
    },
    "defaultMassGeneratorTableUuid": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorTableUuid.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorTableUuid.Hint",
        type: String,
        scope: "user",
        default: "",
        hidden: true
    },
    "defaultMassGeneratorFolderField": {
        name: "PTU.Settings.Generation.DefaultMassGeneratorFolderField.Name",
        hint: "PTU.Settings.Generation.DefaultMassGeneratorFolderField.Hint",
        type: String,
        scope: "user",
        default: "",
        hidden: true
    },
}

export class GenerationSettings extends PTUSettingsMenu {
    static namespace = "generation";

    static get settings() {
        return GenerationSettingsConfig;
    }

    static get SETTINGS() {
        return Object.keys(GenerationSettingsConfig);
    }
}