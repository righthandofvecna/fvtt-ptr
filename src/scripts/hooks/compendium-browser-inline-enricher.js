/**
 * @param {Array<string>} values ["athlete", "ace-trainer-cr"]
 * @param {string} paramName Parameter name as named in compendium browser filter data, e.g. "types"
 * @param {Object} filterData Whole filterData of CompendiumBrowserTab. Will not get modified.
 *
 * @return {Object} New Object for filter data, merged with provided
 */
function checkboxes(values, paramName, filterData) {
    const fd = deepClone(filterData)
    fd.checkboxes[paramName].selected = []
    for (const optionName of Object.keys(fd.checkboxes[paramName].options)) {
        fd.checkboxes[paramName].options[optionName].selected = false;
    }
    for (const value of values) {
        if (fd.checkboxes[paramName].options[value] === undefined) continue;
        fd.checkboxes[paramName].options[value].selected = true;
        fd.checkboxes[paramName].selected.push(value)
    }
    return fd
}

/**
 * @param {Array<string>} positives
 * @param {Array<string>} negatives
 * @param {string|null} conjunction "and"|"or"|null
 * @param {string} paramName Parameter name as named in compendium browser filter data, e.g. "types"
 * @param {Object} filterData Whole filterData of CompendiumBrowserTab. Will not get modified.
 *
 * @return {Object} New Object for filter data, merged with provided
 */
function multiselects(positives, negatives, conjunction, paramName, filterData) {
    const fd = deepClone(filterData)

    if (conjunction) fd.multiselects[paramName].conjunction = conjunction;

    const negs = negatives
        .map(value => {
            return {
                value: value,
                not: true,
                label: filterData.multiselects[paramName].options.find(o => o.value === value)?.label ?? value
            }
        })
    const poss = positives
        .filter(v => !v.startsWith("not-"))
        .map(value => {
            return {
                value: value,
                label: filterData.multiselects[paramName].options.find(o => o.value === value)?.label ?? value
            }
        })

    fd.multiselects[paramName].selected = poss.concat(negs)
    return fd
}

/**
 * @param {Number|null} min
 * @param {string} paramName Parameter name as named in compendium browser filter data, e.g. "types"
 * @param {Object} filterData Whole filterData of CompendiumBrowserTab. Will not get modified.
 *
 * @return {Object} New Object for filter data, merged with provided
 */
function sliders(min, max, paramName, filterData) {
    const fd = deepClone(filterData)

    if (min === 0 || min) fd.sliders[paramName].values.min = min
    if (max === 0 || max) fd.sliders[paramName].values.max = max

    return fd;
}

/**
 * @param {string} value
 * @param {string} paramName Parameter name as named in compendium browser filter data, e.g. "types"
 * @param {Object} filterData Whole filterData of CompendiumBrowserTab. Will not get modified.
 *
 * @return {Object} New Object for filter data, merged with provided
 */
function selects(value, paramName, filterData) {
    const fd = deepClone(filterData);
    const legalOptionNames = Object.keys(fd.selects[paramName].options);
    if (legalOptionNames.includes(value)) fd.selects[paramName].selected = value;
    return fd;
}

/**
 * @param {string|null|undefined} by
 * @param {string|null|undefined} dir
 * @param {Object} filterData Whole filterData of CompendiumBrowserTab. Will not get modified.
 *
 * @return {Object} New Object for filter data, merged with provided
 */
function order(by, dir, filterData) {
    const fd = deepClone(filterData)
    if (by) fd.order.by = by
    if (dir) fd.order.direction = by
    return fd
}

/**
 * @param {Array.<String>|null|undefined} values Words to be searched for
 * @param {Object} filterData Whole filterData of CompendiumBrowserTab. Will not get modified.
 *
 * @return {Object} New Object for filter data, merged with provided
 */
function search(values, filterData) {
    const fd = deepClone(filterData)
    if (values) fd.search.text = values.join(" ")
    return fd
}

export const CompendiumBrowserInlineEnricher = {
    listen: () => {

        // Set up a single Enricher that goes through all(?) content and subs the hand written
        // stuff with an anchor https://discord.com/channels/170995199584108546/722559135371231352/1192834854614737068
        Hooks.on('setup', () => {
            CONFIG.TextEditor.enrichers.push({
                pattern: /@CompSearch\[([A-Za-z]+) ?([0-9a-zA-Z\-=" ]*)\](:?{(:?[^\[\]\{\}@]*)?})?/gim,
                enricher: async (match, enrichmentOptions) => {
                    const [tabName, paramString, displayText] = match.slice(1, 4)
                    const tabNameSlug = CONFIG.PTU.util.sluggify(tabName, { camel: "dromedary" })

                    const broken = game?.ptu?.compendiumBrowser 
                        ? game.ptu.compendiumBrowser.tabs[tabNameSlug] === undefined
                        : false;

                    const a = document.createElement("a");
                    a.classList.add("content-link", "compendium-link")

                    a.setAttribute("compendium-link-tab", tabNameSlug)

                    if (broken) {
                        a.classList.add("broken")
                        a.innerHTML = `<i class="fas fa-unlink"></i>`
                        a.insertAdjacentText("beforeend", displayText?.replace("{","")?.replace("}","") || `${tabName} Search` + ` (Broken)`)
                    }
                    else {
                        const pValues = {}
                        pValues["search"] = []
                        // Tokenize param string, supporting key="quoted value with spaces"
                        const tokenRe = /([A-Za-z0-9\-]+)(?:(=)(?:"([^"]*)"|([A-Za-z0-9\-]*)))?/g
                        for (const token of paramString.matchAll(tokenRe)) {
                            const [, name, eq, quotedVal, unquotedVal] = token
                            if (eq !== undefined) {
                                const value = quotedVal !== undefined ? quotedVal : (unquotedVal ?? "")
                                if (!pValues[name]) pValues[name] = new Set()
                                pValues[name].add(value)
                            } else {
                                pValues["search"].push(name)
                            }
                        }
                        for (const pName of Object.keys(pValues)) {
                            a.setAttribute(`compendium-filter-setting-${pName}`, Array.from(pValues[pName]).join(","))
                        }
                        a.innerHTML = `<i class="fas fa-th-list"></i>`
                        a.insertAdjacentText("beforeend", displayText?.replace("{","")?.replace("}","") || `${tabName} Search`)
                    }
                    return a;
                }
            });
        })

        // Register a single global delegated listener so .compendium-link works
        // anywhere in the DOM (actor sheets, embedded items, journal pages, chat, etc.)
        Hooks.once("ready", () => {
            document.body.addEventListener("click", async (event) => {
                const el = event.target.closest(".compendium-link");
                if (!el) return;

                event.preventDefault();

                let tabKey = el.getAttribute("compendium-link-tab");
                if (tabKey === "pokeedges") tabKey = "pokeEdges";
                /** @type {CompendiumBrowserTab} */
                const tab = game.ptu.compendiumBrowser.tabs[tabKey];

                if (!tab) {
                    if (!el.classList.contains("broken")) {
                        el.classList.add("broken");
                        el.firstChild.outerHTML = `<i class="fas fa-unlink"></i>`;
                    }
                    ui.notifications.warn(game.i18n.format("PTU.CompendiumBrowser.Enrichment.UnknownTab", { tabName: tabKey }));
                    return;
                }

                const prefix = "compendium-filter-setting-";

                const allElAttributes = el.getAttributeNames();
                const params = allElAttributes.filter(pName => pName.startsWith(prefix)).map(s => {
                    return {
                        name: s.substring(26),
                        rawString: el.getAttribute(s),
                        used: false
                    }
                });
                const usedParams = [];

                let filterData = await tab.getFilterData();

                const searchWords = el.getAttribute(prefix + "search");
                usedParams.push("search");
                filterData = search(searchWords.split(","), filterData);

                const orderBy = el.getAttribute(prefix + "order-by");
                const orderDir = el.getAttribute(prefix + "order-dir");
                usedParams.push("order-by");
                usedParams.push("order-dir");

                filterData = order(orderBy, orderDir, filterData);

                if (filterData.checkboxes) {
                    for (const checkboxName of Object.keys(filterData.checkboxes)) {
                        const checkboxString = el.getAttribute(prefix + checkboxName);
                        usedParams.push(checkboxName);
                        if (checkboxString) {
                            filterData = checkboxes(checkboxString.split(","), checkboxName, filterData);
                        }
                    }
                }
                if (filterData.selects) {
                    for (const selectName of Object.keys(filterData.selects)) {
                        const selectString = el.getAttribute(prefix + selectName);
                        usedParams.push(selectName);
                        if (selectString) {
                            filterData = selects(selectString, selectName, filterData);
                        }
                    }
                }
                if (filterData.sliders) {
                    for (const sliderName of Object.keys(filterData.sliders)) {
                        const min = el.getAttribute(prefix + `${sliderName}-min`);
                        const max = el.getAttribute(prefix + `${sliderName}-max`);
                        usedParams.push(`${sliderName}-min`);
                        usedParams.push(`${sliderName}-max`);
                        if (min || max) {
                            filterData = sliders(min, max, sliderName, filterData);
                        }
                    }
                }
                if (filterData.multiselects) {
                    for (const multiselectName of Object.keys(filterData.multiselects)) {
                        const multString = el.getAttribute(prefix + multiselectName);
                        usedParams.push(multiselectName);
                        if (multString) {
                            const positives = multString.split(",").filter(s => !s.startsWith("not-"));
                            const negatives = multString.split(",").filter(s => s.startsWith("not-")).map(s => s.substring(4));
                            const conjunction = el.getAttribute(prefix + `${multiselectName}-logic`);
                            usedParams.push(`${multiselectName}-logic`);
                            filterData = multiselects(positives, negatives, conjunction, multiselectName, filterData);
                        }
                    }
                }

                params.filter(p => !usedParams.includes(p.name)).forEach(param => ui.notifications.warn(game.i18n.format("PTU.CompendiumBrowser.Enrichment.UnknownFilterSetting", {
                    filterName: param.name,
                    tabName: tabKey
                })));

                try {
                    await tab.open(filterData);
                } catch (e) {
                    ui.notifications.error(game.i18n.format("PTU.CompendiumBrowser.Enrichment.LikelyMalformedExpressionBrowserCrashed"));
                    throw e;
                }
            });
        });

        Hooks.on("renderChatMessageHTML", (message, html) => {
            message.activateListeners($(html));
        });
    }
}