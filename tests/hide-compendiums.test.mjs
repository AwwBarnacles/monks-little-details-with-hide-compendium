import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("v12 compendium hiding preserves and restores the world list", async () => {
    const listeners = new Map();
    const registered = new Map();
    const stored = new Map([["hide-compendiums.hidden", JSON.stringify(["world.old"])]]);
    const styles = new Map();
    const messages = [];
    let confirm = true;
    let lastDialog;
    let menu;

    globalThis.FormApplication = class {};
    globalThis.Hooks = {
        on: (name, fn) => listeners.set(name, fn),
        once: (name, fn) => listeners.set(name, fn)
    };
    globalThis.CSS = { escape: value => value.replaceAll(".", "\\.") };
    globalThis.document = {
        getElementById: id => styles.get(id),
        createElement: () => ({}),
        head: { append: style => styles.set(style.id, style) }
    };
    globalThis.ui = { notifications: {
        info: message => messages.push(message),
        warn: message => messages.push(message),
        error: message => messages.push(message)
    } };
    globalThis.Dialog = { confirm: async data => { lastDialog = data; return confirm; } };
    const packs = new Map([
        ["world.old", { title: "Old" }],
        ["example.items", { title: "<Items>" }]
    ]);
    globalThis.game = {
        user: { isGM: true },
        modules: new Map(),
        packs,
        i18n: {
            localize: key => key,
            format: (key, values) => `${key} ${JSON.stringify(values)}`
        },
        settings: {
            storage: new Map([["world", { getItem: key => stored.get(key) ?? null }]]),
            register: (namespace, key, data) => registered.set(`${namespace}.${key}`, data),
            registerMenu: (namespace, key, data) => { menu = data; },
            get: (namespace, key) => {
                const id = `${namespace}.${key}`;
                return stored.has(id) ? JSON.parse(stored.get(id)) : registered.get(id).default;
            },
            set: async (namespace, key, value) => {
                const id = `${namespace}.${key}`;
                stored.set(id, JSON.stringify(value));
                registered.get(id).onChange?.(value);
            }
        }
    };

    const source = await readFile(new URL("../apps/hide-compendiums.js", import.meta.url), "utf8");
    const { initHideCompendiums } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
    initHideCompendiums();
    const settingKey = "monks-little-details.hidden-compendiums";
    await listeners.get("ready")();
    assert.deepEqual(JSON.parse(stored.get(settingKey)), ["world.old"]);
    assert.match(styles.get("mld-hidden-compendiums").textContent, /#compendium-popout/);
    assert.match(styles.get("mld-hidden-compendiums").textContent, /data-entry-id="world\\\.old"/);

    const options = [];
    listeners.get("getCompendiumDirectoryEntryContext")(null, options);
    const action = options[0];
    const item = { data: key => key === "entryId" ? "example.items" : undefined };
    assert.equal(action.condition(item), true);
    game.user.isGM = false;
    assert.equal(action.condition(item), false);
    game.user.isGM = true;
    confirm = false;
    await action.callback(item);
    assert.deepEqual(JSON.parse(stored.get(settingKey)), ["world.old"]);
    confirm = true;
    await action.callback(item);
    assert.match(lastDialog.content, /&lt;Items&gt;/);
    assert.deepEqual(JSON.parse(stored.get(settingKey)), ["world.old", "example.items"]);
    assert.match(styles.get("mld-hidden-compendiums").textContent, /example\\\.items/);
    listeners.get("renderCompendiumDirectory")();
    assert.match(styles.get("mld-hidden-compendiums").textContent, /example\\\.items/);

    confirm = false;
    await new menu.type().reset();
    assert.equal(JSON.parse(stored.get(settingKey)).length, 2);
    confirm = true;
    await new menu.type().reset();
    assert.deepEqual(JSON.parse(stored.get(settingKey)), []);
    assert.equal(styles.get("mld-hidden-compendiums").textContent, "");
    await listeners.get("ready")();
    assert.deepEqual(JSON.parse(stored.get(settingKey)), []);
    assert.ok(messages.length > 0);
});
