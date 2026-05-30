export const TrainerPokemonSync = {
  listen() {
      // On game ready, ensure all Pokemon have correct level caps
      Hooks.on("ready", () => {          
          const pokemonWithTrainers = game.actors.filter(actor => 
              actor.type === "pokemon" && 
              actor.flags?.ptu?.party?.trainer
          );
          
          pokemonWithTrainers.forEach(pokemon => {
              try {
                  pokemon.reset();
              } catch (error) {
                  console.error(`PTU | Error initializing level caps for ${pokemon.name}:`, error);
              }
          });
      });

      Hooks.on("updateActor", (actor, updateData, options, userId) => {
          if (actor.type !== "character") return;
          
          const levelUpdated = foundry.utils.hasProperty(updateData, "system.level") ||
                              foundry.utils.hasProperty(updateData, "system.level.current") ||
                              foundry.utils.hasProperty(updateData, "system.level.milestones") ||
                              foundry.utils.hasProperty(updateData, "system.level.miscexp");
          
          if (!levelUpdated) return;
                    
          const trainerPokemon = game.actors.filter(pokemon => 
              pokemon.type === "pokemon" && 
              pokemon.flags?.ptu?.party?.trainer === actor.id
          );
          
          trainerPokemon.forEach(pokemon => {
              try {
                  pokemon.refreshPreparedData();
              } catch (error) {
                  console.error(`PTU | Error updating Pokemon ${pokemon.name}:`, error);
              }
          });
          
          Object.values(ui.windows).forEach(window => {
              if (window.constructor.name === "PTUPokemonTrainingSheet" && window.trainer?.id === actor.id) {
                  window.render(false);
              }
          });
      });
      
      // When Pokemon are added/removed from a trainer's party, refresh their data
      Hooks.on("updateActor", (actor, updateData, options, userId) => {
          if (actor.type !== "pokemon") return;
          
          const partyUpdated = foundry.utils.hasProperty(updateData, "flags.ptu.party");
          
          if (!partyUpdated) return;          
          actor.refreshPreparedData();
      });

      // When a Pokemon is dragged directly into a Party or Box folder (e.g. via the
      // Foundry sidebar), sync flags.ptu.party to match the folder's role so the
      // state stays consistent with what the Party Sheet would set.
      Hooks.on("updateActor", async (actor, updateData, options, userId) => {
          if (actor.type !== "pokemon") return;
          // Only react to folder changes
          if (!foundry.utils.hasProperty(updateData, "folder")) return;
          // Skip if party flags are already being set in the same update (handled elsewhere)
          if (foundry.utils.hasProperty(updateData, "flags.ptu.party")) return;
          // Prevent re-entry from our own follow-up update
          if (options?._ptuFolderSync) return;
          // Only the client that initiated the change should apply the follow-up
          if (game.user.id !== userId) return;

          const newFolderId = updateData.folder;
          if (!newFolderId) return;

          const folder = game.folders.get(newFolderId);
          if (!folder) return;

          // The parent folder must exist and contain a trainer (character) actor
          const parentFolder = folder.folder;
          if (!parentFolder) return;

          const trainer = parentFolder.contents.find(a => a.type === "character");
          if (!trainer) return;

          // Party folder → boxed: false, anything else (Box, custom sub-folder) → boxed: true
          const boxed = folder.name !== "Party";
          const currentFlags = actor.flags?.ptu?.party;
          if (currentFlags?.trainer === trainer.id && currentFlags?.boxed === boxed) return;

          await actor.update(
              { "flags.ptu.party": { trainer: trainer.id, boxed } },
              { _ptuFolderSync: true }
          );
      });
  }
};
