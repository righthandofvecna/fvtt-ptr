/**
 * PTU Combat Tracker Configuration hooks
 */
export class PTUCombatTrackerConfig {
  
  /**
   * Register hooks to handle League Battle setting
   */
  static registerHooks() {  
    // Hook to inject our custom field into the rendered dialog
    // Foundry is not accepting the custom .hbs for now.
    Hooks.on("renderCombatTrackerConfig", (app, element, data) => {
      if (!game.user.isGM) return;
      
      const html = $(element);
      
      const leagueBattle = game.settings.get("ptu", "leagueBattle");
      
      const leagueBattleHtml = `
        <div class="form-group">
          <label for="ptu-league-battle">League Battle?</label>
          <div class="form-fields">
            <input type="checkbox" name="ptu.leagueBattle" id="ptu-league-battle" ${leagueBattle ? 'checked' : ''}>
          </div>
          <p class="hint">Sort player characters in inverted order before pokémon</p>
        </div>
      `;
      
      const skipDefeatedGroup = html.find('input[name="core.combatTrackerConfig.skipDefeated"]').closest('.form-group');
      if (skipDefeatedGroup.length) {
        skipDefeatedGroup.after(leagueBattleHtml);
      }
    });
    
    Hooks.on("renderCombatTrackerConfig", (app, element, data) => {
      const html = $(element);
      const form = html.closest('form');
      
      const saveButton = form.find('button[type="submit"]');
      
      saveButton.on('click', async (event) => {
        setTimeout(async () => {
          const checkbox = html.find('input[name="ptu.leagueBattle"]');
          if (checkbox.length) {
            const isChecked = checkbox.is(':checked');
            const currentValue = game.settings.get("ptu", "leagueBattle");
            
            // Only save if the value actually changed
            if (isChecked !== currentValue) {
              await game.settings.set("ptu", "leagueBattle", isChecked);
            } else {
              console.log("PTU Combat Config | Value unchanged, skipping save to avoid unnecessary initiative reset.");
            }
          }
        }, 100);
      });
    });
  }
}
