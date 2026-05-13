/**
 * Get the character actor from the user's currently controlled token on the canvas.
 * Falls back to the user's configured character if no token is selected.
 */
function _getCharacterWithDex() {
    const controlledToken = canvas.tokens.controlled.at(0);
    if (controlledToken?.actor?.system?.dex) return controlledToken.actor;

    // Fall back
    return game.user.character?.system?.dex ? game.user.character : null;
}

export async function pokedex() {
    const token = game.user.targets.first();
    const actor = token?.actor;
    if (!actor) return ui.notifications.error("Please target a pokemon");

    const species = actor.species;
    if (!species) return ui.notifications.error("Please target a pokemon");

    // Always open the species dex entry sheet
    species.sheet.render(true);

    // Settings check
    const dexOnScanEnabled = game.settings.get("ptu", "automation.dexOnScan");
    if (dexOnScanEnabled) {
        const character = _getCharacterWithDex();

        // Determine the correct slug
        const slug = species.system?.slug || species.slug;

        let didUpdateDex = false;

        if (character) {
            const dex = character.system.dex ?? { seen: [], owned: [] };
            const isUnknown = !dex.seen.includes(slug) && !dex.owned.includes(slug);

            if (isUnknown) {
                await character.update({ "system.dex.seen": [...dex.seen, slug] });
                didUpdateDex = true;

                // Re-render any open sheets for this character (PTUDexSheet, character sheet, etc.)
                for (const w of Object.values(ui.windows)) {
                    if (w.object?.id === character.id) {
                        w.render(true);
                    }
                }
            }
        }

        // Chat message
        const playerName = character?.name ?? game.user.name;
        const pokemonName = actor.name;
        const speciesName = species.name;
        const namePart = pokemonName === speciesName ? pokemonName : `${pokemonName} (${speciesName})`;

        // I chose to make it whisper the message only to GMs and the player in order to avoid chat spam, but this can be changed if needed
        const recipients = game.users.filter(u => u.isGM || u.id === game.userId);

        ChatMessage.create({
            content: didUpdateDex
                ? `${playerName} scanned ${namePart}. A new entry was cataloged in the PokéDex.`
                : `${playerName} scanned ${namePart}. No new information was cataloged in the PokéDex.`,
            speaker: { alias: playerName },
            whisper: recipients,
        });
    }
}