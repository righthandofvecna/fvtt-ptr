/**
 * Returns true when the given actor has unspent advancement resources.
 * @param {PTUActor} actor
 * @returns {boolean}
 */
function hasAdvancementPending(actor) {
  if (!actor?.system) return false;
  const system = actor.system;

  if (actor.type === "character") {
    if ((system.level?.xpPool?.length ?? 0) > 0) return true;
    if ((system.levelUpPoints ?? 0) > 0) return true;
    if (system.feats && system.feats.total < system.feats.max) return true;
    if (system.edges && system.edges.total < system.edges.max) return true;
    return false;
  }

  if (actor.type === "pokemon") {
    if ((system.level?.pendingExp ?? 0) > 0) return true;
    if ((system.levelUpPoints ?? 0) > 0) return true;
    return false;
  }

  return false;
}

function markEntry(el, hasPending) {
  const nameEl = el.querySelector(".entry-name");
  if (!nameEl) return;

  if (hasPending) {
    if (!nameEl.querySelector(".advancement-pending")) {
      const i = document.createElement("i");
      i.classList.add("fas", "fa-arrow-circle-up", "advancement-pending");
      i.title = "Advancement Pending";
      nameEl.prepend(i);
    }
    el.classList.add("has-advancement-pending");
  } else {
    el.classList.remove("has-advancement-pending");
    const icon = nameEl.querySelector(".advancement-pending");
    if (icon) icon.remove();
  }
}

function markFolder(el) {
  if (el.querySelector(".entry-name .advancement-pending")) {
    const header = el.querySelector(":scope > .folder-header, :scope > header");
    if (header && !header.querySelector(".advancement-pending")) {
      const i = document.createElement("i");
      i.classList.add("fas", "fa-arrow-circle-up", "advancement-pending");
      i.title = "Advancement Pending";
      header.querySelector("*:first-child").after(i);
    }
    el.classList.add("has-advancement-pending");
  } else {
    el.classList.remove("has-advancement-pending");
    const icon = el.querySelector(".advancement-pending");
    if (icon) icon.remove();
  }
}

export const AdvancementPending = {
  listen() {
    Hooks.on("renderActorDirectory", (_app, html) => {
      // Mark individual actor entries
      html.querySelectorAll("li[data-entry-id]").forEach((el) => {
        const actorId = el.dataset.entryId;
        const actor = game.actors.get(actorId);
        if (!actor?.isOwner) return;
        if (!hasAdvancementPending(actor)) return;
        markEntry(el, true);
      });

      // Mark folders whose subtree contains any advancement-pending actor
      html.querySelectorAll("li.folder[data-folder-id]").forEach((el) => {
        markFolder(el);
      });
    });

    Hooks.on("updateActor", (actor, updateData) => {
      if (!actor.isOwner) return;

      const hasPending = hasAdvancementPending(actor);
      const entryEl = document.querySelector(`.directory-list li[data-entry-id="${actor.id}"]`);
      if (entryEl) {
        markEntry(entryEl, hasPending);
        // add pending to all folders above
        let folderEl = entryEl.closest("li.folder[data-folder-id]");
        while (folderEl) {
          markFolder(folderEl);
          folderEl = folderEl.parentElement?.closest("li.folder[data-folder-id]");
        }
      }
    });
  }
};
