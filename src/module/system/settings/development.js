import { PTUSettingsMenu } from "./base.js";

const DevelopmentSettingsConfig = {
    "allowUnlinkedTokens": {
        name: "PTU.Settings.Development.AllowUnlinkedTokens.Name",
        hint: "PTU.Settings.Development.AllowUnlinkedTokens.Hint",
        type: Boolean,
        default: false,
        requiresReload: true,
    }
}

export class DevelopmentSettings extends PTUSettingsMenu {
    static namespace = "development";

    static get settings() {
        return DevelopmentSettingsConfig;
    }

    static get SETTINGS() {
        return Object.keys(DevelopmentSettingsConfig);
    }
}