import { sluggify } from "../../../../util/misc.js";
import { CompendiumBrowserTab } from "./base.js";

export class CompendiumBrowserCapabilitiesTab extends CompendiumBrowserTab {
    constructor(browser) {
        super(browser);

        this.searchFields = ["name"]
        this.storeFields = ["name", "uuid", "type", "source", "img", "keywords", "automationStatus"];

        this.index = ["img", "system.source.value", "system.keywords", "system.slug", "system.contentSet", "system.replacesSlug", "flags.ptu.automationStatus"];

        this.filterData = this.prepareFilterData();
    }

    get tabName() {
        return "capabilities"
    }

    get templatePath() {
        return "systems/ptu/static/templates/apps/compendium-browser/partials/capabilities.hbs"
    }

    async loadData() {
        const capabilities = [];
        const indexFields = foundry.utils.duplicate(this.index);
        const sources = new Set();

        const allKeywordsSeen = new Set();

        for await (const { pack, index } of this.browser.packLoader.loadPacks(
            "Item",
            this.browser.loadedPacks(this.tabName),
            indexFields
        )) {
            for (const capabilityData of index) {
                if (capabilityData.type !== "capability") continue;
                if (!this.hasAllIndexFields(capabilityData, indexFields)) continue;

                const source = capabilityData.system.source?.value ?? "";
                const sourceSlug = sluggify(source);
                if (source) sources.add(source);

                for(const keyword of capabilityData.system.keywords) {
                    allKeywordsSeen.add(keyword);
                }

                capabilities.push({
                    name: capabilityData.name,
                    type: capabilityData.type,
                    img: capabilityData.img,
                    uuid: `Compendium.${pack.collection}.${capabilityData._id}`,
                    source: sourceSlug,
                    keywords: capabilityData.system.keywords,
                    slug: capabilityData.system.slug ?? "",
                    contentSet: capabilityData.system.contentSet ?? "",
                    replacesSlug: capabilityData.system.replacesSlug ?? "",
                    automationStatus: capabilityData.flags?.ptu?.automationStatus ?? "needs-automation"
                })
            }
        }

        this.indexData = capabilities;

        // Set filters if necessary
        this.filterData.checkboxes.source.options = this.generateSourceCheckboxOptions(sources);
        this.filterData.multiselects.keywords.options = this.filterOptionsFromSet(allKeywordsSeen);
    }

    filterIndexData(entry) {
        const { checkboxes, multiselects } = this.filterData;

        if(checkboxes.source.selected.length) {
            if(!checkboxes.source.selected.includes(entry.source)) return false;
        }

        if(!this.isEntryHonoringMultiselect(multiselects.keywords, entry.keywords)) return false;

        if (this.filterData.selects?.automationStatus?.selected) {
            if (entry.automationStatus !== this.filterData.selects.automationStatus.selected) return false;
        }

        return true;
    }

    filterOptionsFromSet(set) {
        return [...set].map(value => ({ value, label: value })).sort((a, b) => a.label.localeCompare(b.label));
    }

    /**
     *  @param multiselectFilter - the `selected` from a filter, e.g. `filterData.multiselects.types`
     *  @param entrySetToCheck - the set of an entry corresponding to the filter, e.g. `entry.types`
     *  @return {boolean} - True if the entry honors the filter, i.e. would be valid result
    */
    isEntryHonoringMultiselect(multiselectFilter, entrySetToCheck) {
        const selected = multiselectFilter.selected.filter(s => !s.not).map(s => s.value);
        const notSelected = multiselectFilter.selected.filter(s => s.not).map(s => s.value);
        if (selected.length || notSelected.length) {
            if (notSelected.some(ns => entrySetToCheck.some(e => sluggify(e) === sluggify(ns)))) return false;
            const fulfilled =
                multiselectFilter.conjunction === "and"
                    ? selected.every(s => entrySetToCheck.some(e => sluggify(e) === sluggify(s)))
                    : selected.some(s => entrySetToCheck.some(e => sluggify(e) === sluggify(s)));
            if (!fulfilled) return false;
        }
        return true;
    }

    prepareFilterData() {
        return {
            checkboxes: {
                source: {
                    isExpanded: false,
                    label: "PTU.CompendiumBrowser.FilterOptions.Source",
                    options: {},
                    selected: []
                }
            },
            ...(game.settings.get("ptu", "devMode") ? {
                selects: {
                    automationStatus: {
                        label: "PTU.CompendiumBrowser.FilterOptions.AutomationStatus",
                        options: {
                            "needs-automation": "Needs Automation",
                            "completed": "Completed",
                            "requires-system-changes": "Requires System Changes",
                            "no-automation-needed": "No Automation Needed"
                        },
                        selected: ""
                    }
                }
            } : {}),
            multiselects: {
                keywords: {
                    conjunction: "and",
                    label: "PTU.CompendiumBrowser.FilterOptions.Keywords",
                    options: [],
                    selected: [{value: 'Obsolete', label: 'Obsolete', not: true}]
                }
            },
            order: {
                by: "name",
                direction: "asc",
                options: {
                    name: "PTU.CompendiumBrowser.FilterOptions.Name"
                }
            },
            search: {
                text: ""
            }
        }
    }
} 