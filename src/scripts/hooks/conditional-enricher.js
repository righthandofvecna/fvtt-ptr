import { CONDITIONS } from "./conditional-enricher-conditions.js";

/**
 * Evaluate all [data-if] and [data-if-not] elements inside a DOM container
 * and remove those whose conditions are not satisfied.
 * In dev mode, hidden elements are shown at 80% opacity with a dev notice instead.
 *
 * Elements should look like:
 *   <div data-if="ppVariantEnabled">...</div>
 *   <span data-if-not="contestRulesEnabled">...</span>
 *
 * @param {HTMLElement} container
 */
export function processConditionals(container) {
    const devMode = game.settings.get("ptu", "devMode") ?? false;

    for (const el of Array.from(container.querySelectorAll("[data-if], [data-if-not]"))) {
        const condName = el.getAttribute("data-if") ?? el.getAttribute("data-if-not");
        const invert = el.hasAttribute("data-if-not");
        const cond = CONDITIONS[condName];
        if (!cond) {
            console.warn(`PTU | data-if: Unknown condition "${condName}". Available: ${Object.keys(CONDITIONS).join(", ")}`);
            continue;
        }
        const result = cond();
        const show = invert ? !result : result;

        if (!show) {
            if (devMode) {
                el.style.opacity = "0.8";
                el.style.outline = "2px dashed orange";
                const notice = document.createElement("p");
                notice.style.cssText = "color: orange; font-weight: bold; font-size: 0.85em; margin: 0 0 4px 0;";
                notice.textContent = `\u{1F6A7} DEV: Hidden in play (condition: "${condName}" = ${result}, invert: ${invert})`;
                el.prepend(notice);
            } else {
                el.remove();
            }
        }
    }
}

/**
 * Process [data-if] / [data-if-not] in an HTML string.
 * Returns the processed HTML string.
 *
 * @param {string} html
 * @returns {string}
 */
export function processConditionalsHTML(html) {
    if (!html || (!html.includes("data-if") && !html.includes("data-if-not"))) return html;
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    processConditionals(doc.body.firstChild);
    return doc.body.firstChild.innerHTML;
}

/**
 * Conditional Content Enricher
 *
 * **Block content** (for multi-paragraph HTML blocks in journals/sheets):
 *    Switch to HTML source mode and wrap content with data-if attributes:
 *      <div data-if="ppVariantEnabled">
 *        <p>Any content here.</p>
 *      </div>
 *      <span data-if-not="contestRulesEnabled">Not using contest rules.</span>
 *
 * Available conditions are defined in conditional-enricher-conditions.js.
 */
export const ConditionalContentEnricher = {
    listen() {
        // Process data-if/data-if-not attributes in rendered journal pages
        Hooks.on("renderJournalEntryPageTextSheet", (_sheet, $html) => {
            // Try to find the journal content element first, then fall back to the full html
            let container;
            if ($html instanceof jQuery) {
                container = $html.find("[data-if], [data-if-not]").length
                    ? $html[0]
                    : $html.filter(".journal-page-content").get(0) ?? $html[0];
            } else {
                container = $html;
            }
            if (container) processConditionals(container);
        });
    }
};

