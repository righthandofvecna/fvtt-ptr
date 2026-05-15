import { isObject } from '../../../../util/misc.js';
import { RuleElementForm } from './base.js';

/** @typedef {"array"|"path"|"ownedItems"} ChoicesMode */

class ChoiceSetForm extends RuleElementForm {
  /** @override */
  get template() {
    return "systems/ptu/static/templates/item/rules/choice-set.hbs";
  }

  /** @override */
  async getData() {
    const data = await super.getData();
    let choices = this.rule.choices;

    /** @type {ChoicesMode} */
    let choicesMode;
    if (Array.isArray(choices)) {
      choicesMode = "array";
      choices = await Promise.all(this.rule.choices.map(async (c) => {
        c.predicate ??= [];
        return {
        ...c,
        link: await fromUuid(c.value).then(item=>item.linkHtml).catch(() => ""),
        predicateIsMultiple: Array.isArray(c.predicate) && c.predicate.every(p => typeof p === "string" || (isObject(p) && Object.keys(p).length === 1 && typeof p.value === "string")),
      }}));
    }
    else if (typeof choices === "string") choicesMode = "path";
    else if (isObject(choices) && choices.ownedItems) choicesMode = "ownedItems";
    else choicesMode = "array";

    // Normalize allowedDrops so null predicate renders as [] rather than "null" in tagify
    const allowedDropsEnabled = this.rule.allowedDrops != null;
    const allowedDrops = allowedDropsEnabled
      ? { ...this.rule.allowedDrops, predicate: this.rule.allowedDrops.predicate ?? [] }
      : { label: "", predicate: [] };

    return {
      ...data,
      rule: { ...this.rule, allowedDrops },
      choicesMode,
      choices,
      // adjustName defaults to true in the schema; make that explicit for the template
      adjustName: this.rule.adjustName !== false,
      allowedDropsEnabled,
      allowedDropsPredicateIsMultiple: allowedDropsEnabled && Array.isArray(allowedDrops.predicate) && allowedDrops.predicate.every(p => typeof p === "string" || (isObject(p) && Object.keys(p).length === 1 && typeof p.value === "string")),
    };
  }

  /** @override */
  activateListeners(html) {
    // Mode switcher — converts choices structure and re-renders
    html.querySelector("[data-action=choices-mode]")?.addEventListener("change", (event) => {
      event.stopPropagation();
      const newMode = event.target.value;
      let newChoices;
      if (newMode === "array") newChoices = [];
      else if (newMode === "path") newChoices = "";
      else if (newMode === "ownedItems") newChoices = { ownedItems: true, types: [] };
      this.updateItem({ choices: newChoices });
    });

    // Add a blank choice row
    html.querySelector("[data-action=choice-add]")?.addEventListener("click", () => {
      const choices = Array.isArray(this.rule.choices) ? [...this.rule.choices] : [];
      choices.push({ value: "", label: "" });
      this.updateItem({ choices });
    });

    // Remove a choice row
    html.querySelectorAll("[data-action=choice-remove]").forEach((el) => {
      el.addEventListener("click", (event) => {
        const idx = Number(event.currentTarget.dataset.idx);
        const choices = Array.isArray(this.rule.choices) ? [...this.rule.choices] : [];
        choices.splice(idx, 1);
        this.updateItem({ choices });
      });
    });

    // Toggle each choice's predicate between tagify (Multiple) and raw JSON (Complex)
    html.querySelectorAll("[data-action=toggle-choice-predicate]").forEach((el) => {
      el.addEventListener("click", (event) => {
        const idx = Number(event.currentTarget.dataset.idx);
        const choices = Array.isArray(this.rule.choices) ? [...this.rule.choices] : [];
        const predicate = choices[idx]?.predicate ?? [];
        const newPredicate = Array.isArray(predicate)
          ? { and: predicate.length ? predicate : [] }
          : predicate?.and?.length ? predicate.and : [];
        choices[idx] = { ...choices[idx], predicate: newPredicate };
        this.updateItem({ choices });
      });
    });

    // Enable/disable allowedDrops entirely
    html.querySelector("[data-action=toggle-allowed-drops]")?.addEventListener("change", (event) => {
      event.stopPropagation();
      if (event.target.checked) {
        this.updateItem({ allowedDrops: { label: "", predicate: [] } });
      } else {
        const rules = this.item.toObject().system.rules;
        delete rules[this.index].allowedDrops;
        this.item.update({ ["system.rules"]: rules });
      }
    });

    // Toggle allowedDrops predicate between tagify (Multiple) and raw JSON (Complex)
    html.querySelector("[data-action=toggle-allowed-drops-predicate]")?.addEventListener("click", () => {
      const predicate = this.rule.allowedDrops?.predicate ?? [];
      const newValue = Array.isArray(predicate)
        ? { and: predicate.length ? predicate : [] }
        : predicate?.and?.length ? predicate.and : [];
      this.updateItem({ allowedDrops: { ...(this.rule.allowedDrops ?? {}), predicate: newValue } });
    });

    // Drop zone: drag an Item from the sidebar/compendium → adds a UUID choice
    const dropZone = html.querySelector("[data-action=drop-choice]");
    if (dropZone) {
      dropZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      dropZone.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        if (dropData.type !== "Item") return;
        (fromUuid(dropData.data ? `Item.${dropData.data._id}` : dropData.uuid)).then((item) => {
          if (!item) {
            console.error(`PTU | ChoiceSetForm | Item not found`, dropData);
            return;
          }
          const choices = Array.isArray(this.rule.choices) ? [...this.rule.choices] : [];
          choices.push({ value: item.uuid, label: item.name });
          this.updateItem({ choices });
        }).catch((err) => {
          console.error("PTU | ChoiceSetForm | Drop error", err);
        });
      });
    }
  }

  /** @override */
  _updateObject(formData) {
    const c = formData.choices;

    if (!Array.isArray(c) && typeof c !== "string") {
      if (isObject(c) && (c.ownedItems === true || c.ownedItems === "true")) {
        // Owned Items mode
        formData.choices.ownedItems = true;
        // Tagify sends [{value:"move"}, ...]; convert to plain strings
        if (Array.isArray(c.types) && c.types.every((t) => t?.value !== undefined)) {
          formData.choices.types = c.types.map((t) => t.value).filter(Boolean);
        }
      } else if (isObject(c)) {
        // Array mode: choices came in as object with numeric string keys from form expansion
        formData.choices = Object.values(c).filter((entry) => entry?.value).map((entry) => {
          const raw = entry.predicate;
          if (!raw) {
            delete entry.predicate;
          } else {
            try {
              const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
              if (Array.isArray(parsed)) {
                const unwrapped = parsed.every(p => isObject(p) && typeof p.value === "string")
                  ? parsed.map(p => p.value).filter(Boolean)
                  : parsed;
                if (unwrapped.length === 0) delete entry.predicate;
                else entry.predicate = unwrapped;
              } else {
                entry.predicate = parsed;
              }
            } catch (error) {
              ui.notifications.error(game.i18n.format("PTU.RuleParseSyntaxError", { message: error.message }));
              throw error;
            }
          }
          return entry;
        });
      }
    }

    // Clean up optional string fields
    if (!formData.flag) delete formData.flag;
    if (!formData.rollOption) delete formData.rollOption;
    if (formData.prompt === "") delete formData.prompt;

    // Booleans: delete when at their defaults to keep data clean
    if (formData.adjustName !== false) delete formData.adjustName;
    if (!formData.allowNoSelection) delete formData.allowNoSelection;

    // Parse allowedDrops.predicate from string to JSON
    if (formData.allowedDrops && typeof formData.allowedDrops === "object") {
      const adPred = formData.allowedDrops.predicate;
      if (!adPred) {
        delete formData.allowedDrops.predicate;
      } else if (typeof adPred === "string") {
        try {
          const parsed = JSON.parse(adPred);
          if (Array.isArray(parsed)) {
            const unwrapped = parsed.every(p => isObject(p) && typeof p.value === "string")
              ? parsed.map(p => p.value).filter(Boolean)
              : parsed;
            if (unwrapped.length === 0) delete formData.allowedDrops.predicate;
            else formData.allowedDrops.predicate = unwrapped;
          } else {
            formData.allowedDrops.predicate = parsed;
          }
        } catch (error) {
          ui.notifications.error(game.i18n.format("PTU.RuleParseSyntaxError", { message: error.message }));
          throw error;
        }
      } else if (Array.isArray(adPred) && adPred.every(p => isObject(p) && typeof p.value === "string")) {
        const unwrapped = adPred.map(p => p.value).filter(Boolean);
        if (unwrapped.length === 0) delete formData.allowedDrops.predicate;
        else formData.allowedDrops.predicate = unwrapped;
      }
      // If label and predicate are both empty, clear allowedDrops entirely
      if (!formData.allowedDrops.label && (!Array.isArray(formData.allowedDrops.predicate) || !formData.allowedDrops.predicate.length)) {
        formData.allowedDrops = null;
      }
    }
  }
}

export { ChoiceSetForm };
