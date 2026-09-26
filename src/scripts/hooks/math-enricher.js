import { RuleElementPTU } from "../../module/rules/rule-element/base.js";

export const MathEnricher = {
  listen() {
    Hooks.on('setup', () => {
      CONFIG.TextEditor.enrichers.push({
        pattern: /@Math\[([^\[\]]*)\](:?{(:?[^\[\]\{\}@]*)?})?/gim,
        enricher: async (match, enrichmentOptions) => {
          const [paramString, displayText] = match.slice(1, 4)

          const span = document.createElement("span");
          const relativeTo = enrichmentOptions?.relativeTo ?? null;

          if (!relativeTo) {
            span.innerText = displayText ?? "None";
            return span;
          }

          let actor = null
          let item = null;
          if (relativeTo.type == "Actor") {
            actor = relativeTo;
          } else {
            actor = relativeTo.actor ?? null;
            item = relativeTo;
          }
          if (!actor) {
            span.innerText = displayText ?? "None";
            return span;
          }

          // resolve injected dependencies
          let resolved = RuleElementPTU.prototype.resolveInjectedProperties.call({item}, paramString, { actor, item });
          try {
              resolved = Roll.safeEval(resolved);
          } catch { }
          span.innerText = resolved ?? displayText ?? "None";

          return span;
        }
      });
    });
  }
};