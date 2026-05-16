const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class RollInspectorDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "ptu-roll-inspector",
        classes: ["ptu", "roll-inspector"],
        position: {
            width: 500,
            height: 500,
        },
        window: {
            title: "Roll Inspector",
            minimizable: true,
            resizable: true,
        },
    };

    static PARTS = {
        content: {
            template: "systems/ptu/static/templates/apps/roll-inspector.hbs",
        },
    };

    constructor(message, options = {}) {
        super(options);
        this.message = message;
    }

    /** @override */
    async _prepareContext(_options) {
        const ctx = this.message.flags?.ptu?.context ?? {};
        const domains = (ctx.domains ?? []).slice().sort();
        const rawOptions = (ctx.options ?? []).slice().sort();

        // Group roll options by their first colon-separated namespace segment
        const groupMap = new Map();
        for (const option of rawOptions) {
            const colonIdx = option.indexOf(":");
            const namespace = colonIdx === -1 ? option : option.slice(0, colonIdx);
            if (!groupMap.has(namespace)) groupMap.set(namespace, []);
            groupMap.get(namespace).push(option);
        }

        // Sort groups alphabetically by namespace
        const optionGroups = Array.from(groupMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([namespace, options]) => ({ namespace, options }));

        return {
            domains,
            optionGroups,
            totalOptions: rawOptions.length,
            type: ctx.type ?? null,
        };
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;

        const searchInput = html.querySelector(".roll-inspector-search");
        if (!searchInput) return;

        searchInput.addEventListener("input", () => {
            const query = searchInput.value.trim().toLowerCase();

            // Filter domain items
            for (const item of html.querySelectorAll(".domain-item")) {
                item.hidden = query.length > 0 && !item.textContent.toLowerCase().includes(query);
            }

            // Filter option items and hide empty groups
            for (const group of html.querySelectorAll(".option-group")) {
                let visibleCount = 0;
                for (const item of group.querySelectorAll(".roll-option-item")) {
                    const matches = !query.length || item.textContent.toLowerCase().includes(query);
                    item.hidden = !matches;
                    if (matches) visibleCount++;
                }
                group.hidden = visibleCount === 0;
            }
        });

        // Auto-focus the search input
        searchInput.focus();
    }
}
