export function registerTemplates() {
    return foundry.applications.handlebars.loadTemplates([

        // Actor Sheet Partials
        // "systems/ptu/templates/partials/active-effects.hbs",
        "systems/ptu/static/templates/partials/mod-field.hbs",
        "systems/ptu/static/templates/partials/item-display-partial.hbs",

        // Item Sheet Partials
        "systems/ptu/static/templates/partials/rules/rule-partial.hbs",
        "systems/ptu/static/templates/partials/species-item-partial.hbs",
        "systems/ptu/static/templates/partials/item-frequency-partial.hbs",

        // Token Panel partials
        "systems/ptu/static/templates/partials/token-panel/tab-strip-tabs-partial.hbs",
        "systems/ptu/static/templates/partials/token-panel/items-body-partial.hbs",
        "systems/ptu/static/templates/partials/token-panel/status-blocks-partial.hbs",

        // Token Sheet partials
        "systems/ptu/static/templates/config/token/appearance-partial.hbs",
        "systems/ptu/static/templates/config/token/identity-partial.hbs",

        "systems/ptu/static/templates/apps/compendium-browser/filters.hbs",
        "systems/ptu/static/templates/apps/compendium-browser/browser-settings.hbs",

        // GitHub Sync
        "systems/ptu/static/templates/apps/github-sync.hbs",

        // Charactermancer Partials
        // "systems/ptu/templates/partials/charactermancer-evolution-partial.hbs",
        // "/systems/ptu/templates/partials/charactermancer/stat-block-partial.hbs"
    ]);
};