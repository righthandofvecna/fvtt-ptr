


export const ItemListerInlineEnricher = {
  listen() {
    Hooks.on('setup', () => {
      CONFIG.TextEditor.enrichers.push({
        pattern: /@ItemSearch\[([0-9a-zA-Z\-=" ]*)\](:?{(:?[^\[\]\{\}@]*)?})?/gim,
        enricher: async (match, enrichmentOptions) => {
          const [paramString, displayText] = match.slice(1, 4)

          const span = document.createElement("span");
          const relativeTo = enrichmentOptions?.relativeTo ?? null;

          if (!relativeTo) {
            span.innerText = displayText ?? "None";
            return span;
          }

          let actor = null
          if (relativeTo.type == "Actor") {
            actor = relativeTo;
          } else {
            actor = relativeTo.actor ?? null;
          }
          if (!actor) {
            span.innerText = displayText ?? "None";
            return span;
          }

          const pValues = {}
          // Tokenize param string, supporting key="quoted value with spaces"
          const tokenRe = /([A-Za-z0-9\-]+)(?:(=)(?:"([^"]*)"|([A-Za-z0-9\-]*)))?/g
          for (const token of paramString.matchAll(tokenRe)) {
              const [, name, eq, quotedVal, unquotedVal] = token
              const value = quotedVal !== undefined ? quotedVal : (unquotedVal ?? "")
              if (!pValues[name]) pValues[name] = new Set()
              pValues[name].add(value)
          }

          // find all matching items
          const matching = actor.items.contents.filter(item => {
            if (pValues.keyword) {
              const kwi = pValues.keyword.intersection(new Set(item.system.keywords));
              if (kwi.size !== pValues.keyword.size) return false;
            }
            return true;
          });

          console.log("PTU | ItemListenerInlineEnricher", { pValues, enrichmentOptions, matching });

          for (const item of matching) {
            if (span.childNodes.length > 0) {
              span.insertAdjacentText("beforeend", ", ");
            }
            $(item.linkHtml).appendTo(span);
          }


          // for (const pName of Object.keys(pValues)) {
          //     a.setAttribute(`compendium-filter-setting-${pName}`, Array.from(pValues[pName]).join(","))
          // }
          // a.innerHTML = `<i class="fas fa-th-list"></i>`
          // a.insertAdjacentText("beforeend", displayText?.replace("{","")?.replace("}","") || `${tabName} Search`)

          return span;
        }
      });
    });
  }
};