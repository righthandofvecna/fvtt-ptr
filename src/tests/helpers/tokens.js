/**
 * Places a token for the given actor onto the current scene (or a specified one).
 * The token is placed at a reasonable default position.
 *
 * @param {PTUActor} actor
 * @param {Scene} [scene] - Defaults to the currently viewed scene.
 * @param {object} [tokenData={}] - Additional token data overrides.
 * @returns {Promise<TokenDocument>} The created token document.
 */
async function placeToken(actor, scene, tokenData = {}) {
    scene ??= canvas?.scene ?? game.scenes.viewed;
    if (!scene) throw new Error("No active scene found. Please load a scene before running token tests.");

    const [token] = await scene.createEmbeddedDocuments("Token", [
        foundry.utils.mergeObject({
            actorId: actor.id,
            actorLink: true,
            x: 100,
            y: 100,
            width: 1,
            height: 1,
            name: actor.name,
        }, tokenData)
    ]);
    return token;
}

/**
 * Removes a token from its scene. Silently ignores null/missing tokens.
 *
 * @param {TokenDocument|null|undefined} token
 */
async function removeToken(token) {
    if (!token) return;
    const parent = token.parent ?? token.scene;
    if (!parent) return;
    const existing = parent.tokens?.get(token.id);
    if (existing) await existing.delete();
}

export { placeToken, removeToken };
