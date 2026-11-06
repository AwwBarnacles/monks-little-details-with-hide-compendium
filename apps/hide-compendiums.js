import { MonksLittleDetails, i18n, setting } from '../monks-little-details.js';

const SETTING = "hidden-compendiums";
const STYLE_ID = "mld-hide-compendiums-style";

const escapeHTML = str => String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toElement = li => (li instanceof HTMLElement ? li : li?.[0]);

export class HideCompendiums {
    static get hidden() {
        const value = game.settings.get("monks-little-details", SETTING);
        return Array.isArray(value) ? value : [];
    }

    static async reset() {
        const count = HideCompendiums.hidden.length;
        await game.settings.set("monks-little-details", SETTING, []);
        ui.notifications.info(game.i18n.format("MonksLittleDetails.hide-compendiums.reset-done", { count }));
    }

    static registerSettings() {
        game.settings.register("monks-little-details", SETTING, {
            scope: "world",
            config: false,
            type: Array,
            default: [],
            onChange: () => HideCompendiums.apply()
        });
        game.settings.registerMenu("monks-little-details", "reset-hidden-compendiums", {
            name: "MonksLittleDetails.hide-compendiums.reset-name",
            label: "MonksLittleDetails.hide-compendiums.reset-label",
            hint: "MonksLittleDetails.hide-compendiums.reset-hint",
            icon: "fa-solid fa-eye",
            type: ResetHiddenMenu,
            restricted: true
        });
    }

    // A stylesheet rule is used instead of inline styles so that sidebar re-renders and
    // the compendium filters/search (which set inline display styles) cannot bring entries back.
    static apply() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement("style");
            style.id = STYLE_ID;
            document.head.append(style);
        }
        style.textContent = HideCompendiums.hidden
            .map(id => `.directory-item[data-pack="${CSS.escape(id)}"] { display: none !important; }`)
            .join("\n");
    }

    static init() {
        HideCompendiums.registerSettings();
        Hooks.once("ready", () => HideCompendiums.apply());
        Hooks.on("renderCompendiumDirectory", () => HideCompendiums.apply());

        Hooks.on("getCompendiumDirectoryEntryContext", (app, options) => {
            options.push({
                name: "MonksLittleDetails.hide-compendiums.hide",
                icon: '<i class="fa-solid fa-trash"></i>',
                condition: li => game.user.isGM && !!game.packs.get(toElement(li)?.dataset.pack),
                callback: async li => {
                    const id = toElement(li).dataset.pack;
                    const pack = game.packs.get(id);
                    const title = pack?.title ?? id;
                    const ok = await foundry.applications.api.DialogV2.confirm({
                        window: { title: game.i18n.localize("MonksLittleDetails.hide-compendiums.hide") },
                        content: `<p>${game.i18n.format("MonksLittleDetails.hide-compendiums.confirm", { name: escapeHTML(title) })}</p>`
                    });
                    if (!ok) return;
                    await game.settings.set("monks-little-details", SETTING, [...new Set([...HideCompendiums.hidden, id])]);
                    ui.notifications.info(game.i18n.format("MonksLittleDetails.hide-compendiums.hidden", { name: title }));
                }
            });
        });
    }
}

// Settings menu entry: clicking the button asks for confirmation and runs the reset instead of opening a window.
class ResetHiddenMenu extends foundry.applications.api.ApplicationV2 {
    async render() {
        const ok = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize("MonksLittleDetails.hide-compendiums.reset-label") },
            content: `<p>${game.i18n.localize("MonksLittleDetails.hide-compendiums.reset-confirm")}</p>`
        });
        if (ok) await HideCompendiums.reset();
        return this;
    }
}
