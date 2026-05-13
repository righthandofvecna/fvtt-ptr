import { GithubSyncManager } from "./github-sync/manager.js";

/**
 * The custom Journal Sheet used for Kingmaker content.
 */
export default class PTURuleBookJournal extends foundry.appv1.sheets.JournalSheet {
    constructor(doc, options) {
      super(doc, options);
      this.options.classes.push("ptu", "rulebook");
    }

    /** @override */
    _getHeaderButtons() {
      const buttons = super._getHeaderButtons();

      if (game.settings.get("ptu", "devMode") && GithubSyncManager.isCommittableJournal(this.object)) {
        buttons.unshift({
          label: "Commit to GitHub",
          class: "commit-to-github",
          icon: "fa-solid fa-upload",
          onclick: () => GithubSyncManager.commitJournalToGithub(this.object),
        });
      }

      return buttons;
    }
  }
  