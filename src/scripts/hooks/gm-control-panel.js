import { GMControlPanel } from "../../module/apps/gm-control-panel.js";

let _panel = null;

function _onRenderSidebar(_app, html) {
    if (!game.user.isGM) return;
    const tabs = html.querySelector?.(".tabs menu");
    if (!tabs) return;

    // Avoid duplicate injection on re-renders
    if (tabs.querySelector(".ptu-gm-panel-btn")) return;

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "ptu-gm-panel-btn ui-control plain icon fa-solid fa-shield-halved";
    btn.setAttribute("data-tooltip", "GM Controls");
    btn.setAttribute("data-tooltip-direction", "UP");
    btn.setAttribute("type", "button");
    btn.addEventListener("click", () => {
        if (!_panel) _panel = new GMControlPanel();
        if (_panel.rendered) _panel.close();
        else _panel.render(true);
    });
    li.appendChild(btn);
    tabs.appendChild(li);
}

export const GMControlPanelHook = {
    listen() {
        Hooks.on("renderSidebar", _onRenderSidebar);
    },
};
