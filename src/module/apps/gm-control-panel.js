const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

export class GMControlPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "ptu-gm-control-panel",
    classes: ["ptu", "gm-control-panel"],
    position: {
      width: 300,
    },
    window: {
      title: "GM Controls",
      minimizable: true,
      resizable: false,
    },
    actions: {
      resetSceneUses: GMControlPanel.#resetSceneUses,
      resetDailyUses: GMControlPanel.#resetDailyUses,
      resetCustomFrequencyUses: GMControlPanel.#resetCustomFrequencyUses,
      healAllActors: GMControlPanel.#healAllActors,
      rest: GMControlPanel.#rest,
    },
  };

  static PARTS = {
    content: {
      template: "systems/ptu/static/templates/apps/gm-control-panel.hbs",
    },
  };

  /** @override */
  async _prepareContext(_options) {
    return {};
  }

  static async #resetSceneUses() {
    const updates = [];
    for (const actor of game.actors.values()) {
      for (const item of actor.items.values()) {
        if (item.system.frequency?.type !== "scene") continue;
        const max = item.system.frequency?.max ?? 0;
        if (!max) continue;
        updates.push(item.setFlag("ptu", "used", 0));
      }
    }
    await Promise.all(updates);
    game.ptu.tokenPanel?.refresh?.();
    ui.notifications.info("Scene uses reset for all actors.");
  }

  static async #resetDailyUses() {
    const updates = [];
    for (const actor of game.actors.values()) {
      for (const item of actor.items.values()) {
        if (!["daily", "scene"].includes(item.system.frequency?.type)) continue;
        const max = item.system.frequency?.max ?? 0;
        if (!max) continue;
        updates.push(item.setFlag("ptu", "used", 0));
      }
    }
    await Promise.all(updates);
    game.ptu.tokenPanel?.refresh?.();
    ui.notifications.info("Daily uses reset for all actors.");
  }

  static async #resetCustomFrequencyUses() {
    const updates = [];
    for (const actor of game.actors.values()) {
      for (const item of actor.items.values()) {
        if (item.system.frequency?.type !== "custom") continue;
        const max = item.system.frequency?.max ?? 0;
        if (!max) continue;
        updates.push(item.setFlag("ptu", "used", 0));
      }
    }
    await Promise.all(updates);
    game.ptu.tokenPanel?.refresh?.();
    ui.notifications.info("Custom frequency uses reset for all actors.");
  }

  static async #healAllActors() {
    const confirmed = await DialogV2.confirm({
      window: { title: "Heal All Actors" },
      content: "<p>Restore <em>all actors</em> to full health, reduce injuries by 3, and remove all conditions?</p>",
      rejectClose: false,
    });
    if (!confirmed) return;

    const actorUpdates = [];
    for (const actor of game.actors.values()) {
      if (!actor) continue;
      // delete effects first so things reducing max HP don't stick around
      await actor.deleteEmbeddedDocuments(
        "Item",
        actor.items.filter(i => i.type === "condition" && !i.isGranted).map(i => i.id)
      );
      actorUpdates.push({
        _id: actor.id,
        "system.health.value": actor.system.health.total,
        "system.health.injuries": Math.max(0, (actor.system.health.injuries ?? 0) - 3),
      });
    }
    if (actorUpdates.length > 0) {
      await Actor.updateDocuments(actorUpdates);
    }
    game.ptu.tokenPanel?.refresh?.();
    ui.notifications.info(`Healed ${actorUpdates.length} actor(s).`);
  }

  static async #rest() {
    const dialogHTML = `
      <form class="rest-dialog">
        <div class="form-group">
          <a class="content-link" draggable="true" data-link="" data-uuid="Compendium.ptu.journals.JournalEntry.NuifZmyV41EwsMns.JournalEntryPage.NAEMeEwuP73MtrDX" data-id="NAEMeEwuP73MtrDX" data-type="JournalEntryPage" data-pack="ptu.journals" data-tooltip="Page" data-tooltip-text="Resting"><i class="fa-solid fa-file-lines" inert=""></i>Resting Rules Reference</a>
        </div>
        <div class="form-group">
            <label>Rest Duration</label>
            <div class="form-fields">
                <input type="range" name="hours" min="0.5" step="0.5" value="8" max="8" />
                <span class="time-label">1 hour</span>
            </div>
        </div>
        <div class="form-group">
            <label>Pokémon Center</label>
            <div class="form-fields">
                <input type="checkbox" name="pokemonCenter" />
            </div>
        </div>
        <div class="poke-center-warning"></div>
      </form>
    `;

    const getPokeCenterWarnings = (hours) => {
        const actors = [...game.actors.values()].filter(a => a.hasPlayerOwner);
        const warnings = actors
            .map(actor => {
                const injuries = Math.max(actor.system.health.injuries ?? 0, 0);
                const requiredHours = injuries < 5 ? (2 + injuries) / 2 : 1 + injuries;
                return { actor, requiredHours };
            })
            .filter(({ requiredHours }) => requiredHours > hours);

        if (warnings.length === 0) return "";

        const warningList = warnings.map(({ actor, requiredHours }) => {
            const hours = Math.floor(requiredHours);
            const minutes = (requiredHours % 1) * 60;
            const timeString = `${hours > 0 ? `${hours}h` : ""}${minutes > 0 ? `${minutes}m` : ""}`.trim() || "0m";
            return `<li>${actor.trainer?.name ?? "No Trainer"}'s ${actor.name} (requires ${timeString})</li>`;
        }).join("");

        return `<p>The following actors won't receive full Pokémon Center benefits:</p><ul>${warningList}</ul>`;
    };

    const result = await DialogV2.prompt({
        window: { title: "Rest" },
        content: dialogHTML,
        ok: {
            label: "Rest",
            callback: (event, button) => {
                const form = button.closest("form");
                const formData = new FormData(form);
                return {
                    hours: Number(formData.get("hours")),
                    pokemonCenter: formData.get("pokemonCenter") === "on",
                }
            }
        },
        cancel: { label: "Cancel" },
        render: (event, app) => {
            let html = app.element;
          console.log("Rest dialog rendered", html);
            const hoursInput = html.querySelector('input[name="hours"]');
            const pokemonCenterInput = html.querySelector('input[name="pokemonCenter"]');
            const timeLabel = html.querySelector('.time-label');
            const warningDiv = html.querySelector('.poke-center-warning');

            const updateDialog = () => {
                const halfHours = Number(hoursInput.value) * 2;
                const hours = Math.floor(halfHours / 2);
                const minutes = (halfHours % 2) * 30;
                timeLabel.textContent = `${hours > 0 ? `${hours} hour${hours > 1 ? "s" : ""}` : ""}${minutes > 0 ? ` ${minutes} minutes` : ""}`.trim() || "0 minutes";

                if (pokemonCenterInput.checked) {
                    warningDiv.innerHTML = getPokeCenterWarnings(halfHours / 2);
                } else {
                    warningDiv.innerHTML = "";
                }
            };

            hoursInput.addEventListener("input", updateDialog);
            pokemonCenterInput.addEventListener("change", updateDialog);
            updateDialog();
        }
    });

    if (!result) return;

    await game.ptu.macros.applyRest(result.hours, result.pokemonCenter);

    game.ptu.tokenPanel?.refresh?.();
    ui.notifications.info("Actors have rested.");
  }
}
