class PTUHotBar extends foundry.applications.ui.Hotbar {

    async _createDocumentSheetToggle(doc) {
        if (doc.documentName === "Item") {
            if (doc.type === "effect" || doc.type === "condition") {
                const command = `const item = await fromUuid("${doc.uuid}");await item?.apply?.(game.user.targets.size > 0 ? [...game.user.targets] : (canvas.tokens.controlled ?? []), "${doc.uuid}")`;
                let macro = game.macros.find(m => m.name === `Apply: ${doc.name}` && m.command === command);
                if (!macro) {
                    macro = await Macro.create({
                        name: `Apply: ${doc.name}`,
                        type: "script",
                        command: command,
                        img: doc.img,
                        flags: { "ptu.itemMacro": true }
                    });
                }
                return macro;
            }

            if (doc.type === "move") {
                const command = `const item = await fromUuid("${doc.uuid}"); await item?.use?.();`;
                let macro = game.macros.find(m => m.name === doc.name && m.command === command);
                if (!macro) {
                    macro = await Macro.create({
                        name: doc.name,
                        type: "script",
                        command: command,
                        img: doc.img,
                        flags: { "ptu.itemMacro": true }
                    });
                }
                return macro;
            }
        }

        return super._createDocumentSheetToggle(doc);
    }

}

export { PTUHotBar }