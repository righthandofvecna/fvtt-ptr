/**
 * @TrainerProgression[key] enricher
 *
 * Renders a table of per-level gains for a given trainer progression.
 * ★ = skip prerequisites
 */
export const TrainerProgressionEnricher = {
    listen() {
        Hooks.on('setup', () => {
            CONFIG.TextEditor.enrichers.push({
                pattern: /@TrainerProgression\[([a-zA-Z0-9\-]+)\]/gim,
                enricher: async (match) => {
                    const key = match[1];
                    const progression = CONFIG.PTU.data.trainerProgressions?.[key];

                    if (!progression) {
                        const span = document.createElement("span");
                        span.style.color = "red";
                        span.textContent = `[TrainerProgression: unknown key "${key}"]`;
                        return span;
                    }

                    // Resolve UUID names asynchronously
                    const uuidNames = {};
                    for (const entry of (progression.bonusItems ?? [])) {
                        for (const opt of entry.options) {
                            for (const uuid of (opt.uuids ?? [])) {
                                if (!uuidNames[uuid]) {
                                    try {
                                        const item = await fromUuid(uuid);
                                        uuidNames[uuid] = item?.name ?? uuid;
                                    } catch {
                                        uuidNames[uuid] = uuid;
                                    }
                                }
                            }
                        }
                    }

                    // Index bonus items by level
                    const bonusByLevel = {};
                    for (const entry of (progression.bonusItems ?? [])) {
                        (bonusByLevel[entry.level] ??= []).push(entry);
                    }

                    // Build the table
                    const table = document.createElement("table");
                    table.classList.add("trainer-progression-table");

                    const thead = table.createTHead();
                    const headerRow = thead.insertRow();
                    for (const text of ["Level", "Tier", "+Stats", "+Feats", "+Edges", "Bonus Items"]) {
                        const th = document.createElement("th");
                        th.textContent = text;
                        headerRow.appendChild(th);
                    }

                    const tbody = table.createTBody();
                    const cap = progression.cap ?? 50;

                    for (let lv = 1; lv <= cap; lv++) {
                        const stats = progression.stats?.[lv] ?? 0;
                        const feats = progression.features?.[lv] ?? 0;
                        const edges = progression.edges?.[lv] ?? 0;
                        const tier = progression.tier?.[lv] ?? "";
                        const bonusEntries = bonusByLevel[lv] ?? [];

                        const row = tbody.insertRow();
                        if (tier) row.classList.add("tier-row");

                        row.insertCell().textContent = String(lv);
                        row.insertCell().textContent = tier;
                        row.insertCell().textContent = stats > 0 ? `+${stats}` : "–";
                        row.insertCell().textContent = feats > 0 ? `+${feats}` : "–";
                        row.insertCell().textContent = edges > 0 ? `+${edges}` : "–";

                        const bonusCell = row.insertCell();
                        if (bonusEntries.length) {
                            const parts = bonusEntries.map(entry => {
                                const optTexts = entry.options.map(opt => {
                                    const count = opt.count ?? 1;
                                    const typeName = opt.itemType === "feature"
                                        ? (count > 1 ? "Feats" : "Feat")
                                        : (count > 1 ? "Edges" : "Edge");
                                    const star = opt.skipPrereqs ? " ★" : "";

                                    if (opt.uuids?.length) {
                                        const names = opt.uuids.map(u => uuidNames[u] ?? u).join(", ");
                                        return `${names}${star}`;
                                    }
                                    if (opt.keywords?.length) {
                                        return `${count > 1 ? count + " " : ""}${opt.keywords.join("/")} ${typeName}${star}`;
                                    }
                                    return `${count > 1 ? count + " " : ""}Any ${typeName}${star}`;
                                });
                                return optTexts.join(" OR ");
                            });
                            bonusCell.innerHTML = parts.map(p => `<span>${p}</span>`).join("<br>");
                        } else {
                            bonusCell.textContent = "–";
                        }
                    }

                    const note = document.createElement("p");
                    note.classList.add("trainer-progression-note");
                    note.textContent = "★ = skip prerequisites";

                    const wrapper = document.createElement("div");
                    wrapper.classList.add("trainer-progression-enricher");
                    wrapper.appendChild(table);
                    wrapper.appendChild(note);
                    return wrapper;
                }
            });
        });
    }
};
