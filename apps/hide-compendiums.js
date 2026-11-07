const MODULE_ID = "monks-little-details";
const LEGACY_MODULE_ID = "hide-compendiums";
const SETTING = "hidden-compendiums";
const LEGACY_KEY = `${LEGACY_MODULE_ID}.hidden`;
const STYLE_ID = "mld-hidden-compendiums";

const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

function getLegacyHidden() {
    const stored = game.settings.storage.get("world").getItem(LEGACY_KEY);
    if (stored === null) return null;
    const hidden = JSON.parse(stored);
    if (!Array.isArray(hidden) || hidden.some(id => typeof id !== "string"))
        throw new Error("Invalid standalone Hide Compendiums world setting");
    return hidden;
}

function getHidden() {
    const stored = game.settings.storage.get("world").getItem(`${MODULE_ID}.${SETTING}`);
    return stored === null ? (getLegacyHidden() ?? []) : game.settings.get(MODULE_ID, SETTING);
}
const getPackId = li => li.data("entryId") ?? li.data("pack");

function applyHidden() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.append(style);
    }

    style.textContent = getHidden().map(id => {
        const escaped = CSS.escape(id);
        return `:is(#compendium, #compendium-popout) .directory-item[data-entry-id="${escaped}"] { display: none !important; }`;
    }).join("\n");
}

class ResetHiddenMenu extends FormApplication {
    render() {
        this.reset();
        return this;
    }

    async reset() {
        const confirmed = await Dialog.confirm({
            title: game.i18n.localize("MonksLittleDetails.hide-compendiums.reset-label"),
            content: `<p>${game.i18n.localize("MonksLittleDetails.hide-compendiums.reset-confirm")}</p>`
        });
        if (!confirmed) return;
        const count = getHidden().length;
        await game.settings.set(MODULE_ID, SETTING, []);
        applyHidden();
        ui.notifications.info(game.i18n.format("MonksLittleDetails.hide-compendiums.reset-done", { count }));
    }
}

export function initHideCompendiums() {
    game.settings.register(MODULE_ID, SETTING, {
        scope: "world",
        config: false,
        type: Array,
        default: [],
        onChange: applyHidden
    });

    game.settings.registerMenu(MODULE_ID, "reset-hidden-compendiums", {
        name: "MonksLittleDetails.hide-compendiums.reset-name",
        label: "MonksLittleDetails.hide-compendiums.reset-label",
        hint: "MonksLittleDetails.hide-compendiums.reset-hint",
        icon: "fas fa-eye",
        type: ResetHiddenMenu,
        restricted: true
    });

    Hooks.once("ready", async () => {
        try {
            const storage = game.settings.storage.get("world");
            if (game.user.isGM && storage.getItem(`${MODULE_ID}.${SETTING}`) === null) {
                const legacy = getLegacyHidden();
                if (legacy !== null) await game.settings.set(MODULE_ID, SETTING, legacy);
            }
            applyHidden();
        } catch (error) {
            console.error("monks-little-details | Could not restore hidden compendiums", error);
            ui.notifications.error(game.i18n.localize("MonksLittleDetails.hide-compendiums.read-error"));
        }
        if (game.user.isGM && game.modules.get(LEGACY_MODULE_ID)?.active)
            ui.notifications.warn(game.i18n.localize("MonksLittleDetails.hide-compendiums.disable-standalone"));
    });
    Hooks.on("renderCompendiumDirectory", applyHidden);
    Hooks.on("getCompendiumDirectoryEntryContext", (html, options) => {
        options.push({
            name: "MonksLittleDetails.hide-compendiums.hide",
            icon: '<i class="fas fa-eye-slash"></i>',
            condition: li => game.user.isGM && !!game.packs.get(getPackId(li)),
            callback: async li => {
                const id = getPackId(li);
                const pack = game.packs.get(id);
                if (!pack) {
                    ui.notifications.warn(game.i18n.localize("MonksLittleDetails.hide-compendiums.missing"));
                    return;
                }
                const name = pack.title ?? id;
                const confirmed = await Dialog.confirm({
                    title: game.i18n.localize("MonksLittleDetails.hide-compendiums.hide"),
                    content: `<p>${game.i18n.format("MonksLittleDetails.hide-compendiums.confirm", { name: escapeHTML(name) })}</p>`
                });
                if (!confirmed) return;
                await game.settings.set(MODULE_ID, SETTING, [...new Set([...getHidden(), id])]);
                applyHidden();
                ui.notifications.info(game.i18n.format("MonksLittleDetails.hide-compendiums.hidden", { name }));
            }
        });
    });
}
