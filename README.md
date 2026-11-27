# Nik's Foundry Tweaks

[![Foundry VTT](https://img.shields.io/badge/Foundry%20VTT-V14-orange.svg)](https://foundryvtt.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/nschoenwald/niks-foundry-tweaks?color=purple)](https://github.com/nschoenwald/niks-foundry-tweaks/releases/latest)

System-independent quality-of-life tweaks for **Foundry VTT (v14)**, and the home of the **Nik's Tweaks settings dashboard**, which system modules like [Nik's DnD5e Tweaks](https://github.com/nschoenwald/niks-dnd5e-tweaks) share.

---

> [!TIP]
> **Modular by Design**: Every tweak can be toggled independently. GMs configure world defaults, while players adjust features for their own screen right inside each feature (**On your screen**).

> [!NOTE]
> **Coming from Nik's DnD5e Tweaks?** These features used to be part of Nik's DnD5e Tweaks. From Nik's DnD5e Tweaks 14.70.0 on, they live here, and Nik's DnD5e Tweaks requires this module. Your settings are copied over automatically the first time the world loads with both modules, both the world settings and each player's personal ones.

---

## ⚡ Quick Navigation

- [📊 Feature Matrix (At a Glance)](#-feature-matrix-at-a-glance)
- [🎨 UI & Visuals](#-ui--visuals)
- [🎯 Canvas & Tokens](#-canvas--tokens)
- [🏁 Combat Flow](#-combat-flow)
- [🔧 Utilities](#-utilities)
- [🛠️ Silent Core Patches](#️-silent-core-patches)
- [⚙️ Settings Dashboard & Personal Preferences](#️-settings-dashboard--personal-preferences)
- [🧩 For Module Developers](#-for-module-developers)
- [🤝 Module Compatibility](#-module-compatibility)
- [📦 Installation](#-installation)
- [❤️ Modules by Nik](#️-modules-by-nik)

---

## 📊 Feature Matrix (At a Glance)

| Feature | Category | Default | Player Preference? |
|---|---|---|---|
| **[Readable Text Size](#readable-text-size)** | UI & Visuals | ✅ Comfortable | Yes |
| **[Sheet Pop-out Button](#sheet-pop-out-button)** | UI & Visuals | ✅ Enabled | Yes |
| **[Clean Sheet Window Titles](#clean-sheet-window-titles)** | UI & Visuals | ✅ Enabled | No |
| **[Context Menu Styling](#context-menu-styling)** | UI & Visuals | ✅ Enabled | Yes |
| **[Reliable Chat Log Auto-Scroll](#reliable-chat-log-auto-scroll)** | UI & Visuals | ✅ Enabled | No |
| **[Hide Private GM Rolls from Players](#hide-private-gm-rolls-from-players)** | UI & Visuals | ✅ Enabled | No |
| **[Actor Directory Disposition Dots](#actor-directory-disposition-dots)** | UI & Visuals | ✅ Enabled | No |
| **[Sidebar Multi-line Names](#sidebar-multi-line-names)** | UI & Visuals | ✅ Enabled | No |
| **[Copy & Move to Folder](#copy--move-to-folder)** | UI & Visuals | ✅ Enabled | Yes |
| **[Compact File Picker](#compact-file-picker)** | UI & Visuals | ✅ Enabled | Yes |
| **[File Picker Thumbnails](#file-picker-thumbnails)** | UI & Visuals | ✅ Enabled | Yes |
| **[Sync Browser Tab Title](#sync-browser-tab-title)** | UI & Visuals | ✅ Enabled | Yes |
| **[Toolbar Limitation](#toolbar-limitation)** | UI & Visuals | ✅ Enabled | Yes |
| **[Clearer Scene Control Toggles](#clearer-scene-control-toggles)** | UI & Visuals | ✅ Enabled | Yes |
| **[Carolingian UI Theme Harmony](#carolingian-ui-theme-harmony)** | UI & Visuals | ✅ Enabled | Yes |
| **[Clear Targets Token Control Button](#clear-targets-token-control-button)** | Canvas & Tokens | ✅ Enabled | Yes |
| **[Disable Underground Token Hiding](#disable-underground-token-hiding)** | Canvas & Tokens | ❌ Disabled | No |
| **[Enhanced Teleport Targeting UI](#enhanced-teleport-targeting-ui-automated-animations-blfx)** | Canvas & Tokens | ✅ Enabled | Yes |
| **[Fade Templates During Animations](#fade-templates-during-animations)** | Canvas & Tokens | ✅ Enabled | Yes |
| **[Boss Loot FX Animation Opacity](#boss-loot-fx-animation-opacity)** | Canvas & Tokens | ❌ Disabled | No |
| **[Auto-Add Tokens to Combat](#auto-add-tokens-to-combat)** | Combat Flow | ✅ Enabled | No |
| **[Auto-Unpause When Logging In](#auto-unpause-when-logging-in)** | Utilities | ❌ Disabled | Yes (GM) |
| **[Delayed Disconnect Warning](#delayed-disconnect-warning)** | Utilities | ✅ Enabled | Yes |
| **[Sync Check](#sync-check)** | Utilities | ✅ Enabled | No |
| **[Debug Mode](#debug-mode)** | Utilities | ❌ Disabled | No |

---

## 🎨 UI & Visuals

### Readable Text Size
Enlarges body text and adds space between lines, without making the rest of the interface bigger the way Foundry's **Font Size** setting does.
* **Covers**: journal pages (while reading and while editing). System modules extend it to their sheets, tooltips and chat cards; with [Nik's DnD5e Tweaks](https://github.com/nschoenwald/niks-dnd5e-tweaks), that is item descriptions, biographies, items expanded on a sheet and item tooltips. Headings scale along; buttons and the rest of the interface keep their size.
* **Levels**: **Comfortable** (default, journals 14px → 16px), **Large** (journals 18px), or **Off** for the system's own sizes. Both still follow Foundry's Font Size setting.
* **Chat Cards**: With a system module that supports it (such as Nik's DnD5e Tweaks), **Readable Text Size in Chat Cards** also enlarges descriptions inside chat cards (off by default, as it makes cards taller). Without one, the option is hidden.
* **World Default & Personal Override**: The GM picks the size (and the chat card option) for everyone. Each player can override both for their own screen (**On your screen** in the feature); their default is **Use World Setting**.

### Sheet Pop-out Button
Adds a dedicated **↗ pop-out button** to Actor and Item sheet window headers to detach them into separate browser windows with one click. Automatically hides when already detached.

### Clean Sheet Window Titles
Removes redundant type prefixes (e.g. *"Non Player Character:"*) from sheet headers, displaying clean titles like *"Goblin Archer"* or *"Potion of Healing"*.
* *Sub-settings*: Title Format (**Name Only**, Type: Name, Name (Type)).

### Context Menu Styling
Color-codes right-click context menu options across sheets, compendiums, directories, and chat:
* **Destructive Actions** (Delete, Remove): Crisp red text.
* **Additive Actions** (Duplicate, Copy): Clear green text.
* **Privacy Actions** (Make Private, Reveal): Luminous violet text.

System modules can add their own menu labels, so system-specific entries are colored too.

### Reliable Chat Log Auto-Scroll
Keeps the chat log scrolled to the bottom when new cards appear, trays expand, dice are revealed or images load after the fact. Only your own scrolling (mouse wheel, keys, touch or dragging the scrollbar) stops it, so you can read older messages undisturbed; scrolling back to the bottom resumes it. It also catches up when you switch back to the chat tab or expand the sidebar.

### Hide Private GM Rolls from Players
Whispered, private and blind rolls made by the GM no longer show up for players as empty placeholder cards in the chat log. System modules can mark their own roll cards, so system rolls are hidden too.

### Actor Directory Disposition Dots
Displays colored disposition dots (Friendly, Neutral, Hostile, Secret) next to actor names in the sidebar.

### Sidebar Multi-line Names
Long names of actors, items, scenes and other documents in the right sidebar wrap onto several lines instead of being cut off.

### Copy & Move to Folder
Adds **Copy to Folder…** and **Move to Folder…** to the right-click menu of documents in the sidebar: scenes, actors, items, journals, roll tables, card stacks, playlists and macros, and the entries of unlocked compendiums. Both open a short dialog with the directory's folders in the same order and nesting as the sidebar, plus **(No Folder)** for the top level. No more dragging through long, collapsed folder lists.

- **Move** puts the document into the chosen folder. Its current folder is marked and can't be picked.
- **Copy** creates a copy in the chosen folder, like Duplicate. In another folder the copy keeps its name; in the same folder it is called "Copy of …".
- Players see the entries for documents they own (Copy also needs permission to create that kind of document). In compendiums, only the GM sees them, and only while the compendium is unlocked. The entries only appear when the directory has folders.

The GM can turn the feature off; players can turn it off for themselves.

### Compact File Picker
Fits more files into Foundry's file picker (the Image Browser and the other file and folder pickers):

- **Resizable.** Drag the bottom-right corner. The picker opens at that size from then on, and keeps it while you browse and search instead of shrinking to the folder's content. Tiles fill the extra width with more columns.
- **Small Tiles view.** A new display mode next to Tiles, with tiles two thirds the size, so about eight fit across the default width instead of five.
- **Less height spent on controls.** The source tabs show the icon beside the name; the S3 bucket, search field and display mode buttons share one row (the bucket list is hidden when the world has only one bucket); upload and selected file share one row, with icons instead of labels.
- **Favorites fold to one line.** A small arrow after "Favorites" shows that more are hidden; hover over the row (or tab into it) to show all of them.
- **Remembers your display mode** between sessions, not just until the next reload.
- **Clearer highlight** of the current or picked file in the tile views.

See also [File Picker Thumbnails](#file-picker-thumbnails), which makes folders with many large images much faster.

The GM can turn the feature off; players can turn it off for themselves.

### File Picker Thumbnails
Foundry's file picker shows every image at full size and lets the browser shrink it, so a folder of large portraits or maps downloads and decodes megabytes of images just to show small tiles. With this feature, the Tiles, Small Tiles and Thumbnails views show real thumbnails instead:

- The first time an image appears, your browser downloads it once, shrinks it to a small thumbnail (256 px on the longest side) and keeps it in its own storage. From then on the picker shows the stored thumbnail: no download, almost nothing to decode, so folders open and scroll quickly.
- Images load as they scroll into view, a few at a time. The large Images view, SVG icons and animated GIFs still use the original files.
- Thumbnails are kept per browser, up to the **Thumbnail Storage Limit** (an *On your screen* option of the feature) (default 1,024 MB, roughly 50,000 to 100,000 thumbnails). When it is full, the thumbnails you haven't seen for the longest time are removed first. Thumbnails are also made again after 30 days. If you replace an image under the same name, choose **Refresh Thumbnails** in the picker's ⋮ menu to update the current folder right away.
- Works with User Data, Core Data and Amazon S3. For S3, the bucket must allow cross-origin requests, which Foundry already needs for S3 images on the canvas. If a thumbnail can't be made, the picker shows the original image.

The GM can turn the feature off; players can turn it off for themselves.

### Sync Browser Tab Title
Dynamically updates the browser tab title with the name of the active scene being viewed.

### Toolbar Limitation
Turns toolbars scrollable when button count exceeds a configured limit (default: 20), preventing overcrowded canvas controls. Layout is recalculated after the window has finished resizing.

### Clearer Scene Control Toggles
Makes on/off toggles in the left scene controls toolbar (such as **Force Snap to Grid Vertices**, **Toggle Notes Display** or **Unconstrained Movement**) easy to tell apart at a glance. Toggles that are off look like normal buttons with a dimmed icon. Toggles that are on keep the normal background but show their icon at full strength, with an accent-colored ring and a small accent dot in the corner, The same applies to choice tools such as **Select** or **Draw Walls**: the selected tool gets the ring and a full-strength icon (no dot, so it never looks like a toggle), and the other choice tools are dimmed. Hovering a button no longer makes it look switched on or selected. One-click buttons such as **Clear** keep their usual look. Works with light and dark interface themes, and with **Carolingian UI**'s left controls, where it follows the active Carolingian color theme. Players can turn it off for themselves (**On your screen** in the feature).

### Carolingian UI Theme Harmony
Adapts the Settings Dashboard and floating canvas banners to **Carolingian UI** color palettes, typography and top scene navigation offsets. System modules add their own parts (with Nik's DnD5e Tweaks: chat cards, template and summoning HUDs, and legendary action placeholders in the Combat Carousel).

---

## 🎯 Canvas & Tokens

### Clear Targets Token Control Button
Adds a dedicated crosshair button to the canvas Token Controls toolbar, positioned directly below the core Select Targets button. Players clear their own targets; GMs clear targets across the entire canvas simultaneously.

### Disable Underground Token Hiding
Prevents tokens with negative elevation from disappearing behind the scene background layer.

### Enhanced Teleport Targeting UI (Automated Animations, BLFX)
Improves teleport destination picking (*Misty Step*, *Dimension Door*) for Automated Animations teleport presets and Boss Loot FX (BLFX) teleports:
* Snaps a translucent ghost token preview to the grid. It is drawn by Foundry like its drag preview, so it looks exactly like the token: Dynamic Token Ring with its colors, background, subject image and scale, plus mirroring and rotation.
* Real-time status badges for valid range, out-of-range, and wall collision.
* The range border follows the scene's grid rules: a square on square grids where every diagonal counts as 5 ft., a circle on other grids (overrides the preset's Circle / Square option). BLFX teleports and D&D 5e's Teleport activity (via Nik's DnD5e Tweaks) get their own border when the range is known: cyan, red while the destination is out of range, shaped by the grid's diagonal rule (square, octagon, hexagon or circle).
* Uninterrupted right-click canvas panning and clean <kbd>ESC</kbd> / Cancel flow.
* **BLFX**: replaces BLFX's destination crosshair (*Misty Step*, *Dimension Door*, *Void Blink*, jumps and other BLFX teleports) with the same banner and ghost preview. BLFX itself knows no range: system modules can supply it (Nik's DnD5e Tweaks reads it from the spell just used), otherwise the banner shows the distance only. Walls don't block. *Dimension Door*'s door image is shown as the preview. Right-click pans the canvas instead of cancelling; use <kbd>ESC</kbd> or Cancel. BLFX placements of objects (e.g. Portal Daggers) keep BLFX's own crosshair.
* **Automated Animations and BLFX on the same spell**: when both start a teleport for one cast (e.g. A-A's *Misty Step* preset and BLFX's auto-rec), you pick the destination once and only BLFX's teleport plays; A-A's preset range is used if nothing else gives one. Two teleports at once used to fight over the token and could leave it invisible. Turn one of them off for that spell to choose which animation you get.
* **System modules**: Nik's DnD5e Tweaks also uses the banner for D&D 5e's own Teleport activity.

### Fade Templates During Animations
While a Sequencer animation (from Automated Animations, Boss Loot FX or any other module) plays on a template, the template's colored fill fades to a fraction of its normal opacity, so the fireball or breath weapon isn't hidden behind it. The fill fades back in when the last animation on it ends; looping animations (*Spirit Guardians*, *Wall of Fire*) keep it faded while they last. Set how visible the fill stays under *Fill Opacity During Animations* (default 25%, 0 hides it). Animations placed at a point instead of on the template don't count. Players can turn it off for themselves.

### Boss Loot FX Animation Opacity
Plays Boss Loot FX (BLFX) animations at a percentage of their normal opacity (default 75%), so tokens, templates and the map stay visible underneath. BLFX's own opacity values and fade-ins scale with it, and animations BLFX hides stay hidden. Only BLFX's own animation files are affected; Automated Animations, JB2A and other modules play as before. The caster's game sets the opacity for everyone, so it is a GM setting only. It applies to animations started after the change: looping animations already on the scene keep the opacity they started with. The setting only shows up while Boss Loot FX is active.

---

## 🏁 Combat Flow

### Auto-Add Tokens to Combat
Tokens created or dragged onto a scene while that scene has a combat are added to it automatically, whichever scene the GM is looking at. A combat not linked to a scene takes tokens from every scene. System modules can leave some tokens out (Nik's DnD5e Tweaks leaves out summoned creatures).

---

## 🔧 Utilities

### Auto-Unpause When Logging In
Per-user GM setting to automatically unpause the world upon login (**Always**, **When no players connected**, or **Never**).

### Delayed Disconnect Warning
Foundry shows "You have lost connection to the server" the moment the connection drops, followed by "Server connection re-established" a second later on a short hiccup. With this feature the warning only appears when the connection stays lost for a few seconds: 5 by default, adjustable from 0 to 60 with **Disconnect Warning Delay (Seconds)**. Drops that reconnect sooner show neither message. Longer outages behave as in core (warning, then the page reloads once the connection is back). Foundry reloads the page whenever a reconnect takes 5 seconds or longer, so with a longer delay such a reload can happen without any warning. Players can turn it off for themselves.

### Sync Check
Every change in Foundry (an effect added, HP lost, a token moved) goes through the server, which passes it on to everyone connected. Someone who is disconnected at that moment never receives it, and Foundry doesn't send it again later. When a connection is lost for 5 seconds or longer, Foundry reloads the page once it is back, which catches up. After a shorter drop it doesn't, so that player can keep seeing an outdated state, e.g. an effect only they still see, or one everyone else sees but they don't.

This feature compares a user's game with the server after a short drop, when their browser tab comes back after at least a minute in the background, or when a GM right-clicks a user in the Players list and picks **Check Sync** (or **Check Sync for All**). It looks at actors, their items and effects, and the tokens of the scene the user is viewing.

If everything matches, nobody sees anything. If something really differs (it is checked twice, so changes still on their way don't count), the user and the GMs get a whispered chat message. The user gets a **Reload** button; GMs see what differs and whether the user has caught up.

Players also get **Sync Now**, which applies the missed changes to actors, their items and their effects without reloading, then checks the result against the server. If something can't be applied this way (for example a token difference or a new actor), the message asks them to reload. GMs only get Reload, because replaying changes on a GM's client could make other modules' automation run twice. Players only see the names of documents they own. If the check itself can't run after a drop, the message says the game *may* be out of sync. No player opt-out, since the message is mainly there for the GM.

Not checked yet: effects stored on items, changes to a token other than its items and effects (such as position or an unlinked token's HP), other scenes, and other document types such as journals or combats.

### Debug Mode
Enables diagnostic logging in the browser console, for this module and every Nik's Tweaks module that uses the dashboard.

---

## 🛠️ Silent Core Patches

Patches are zero-configuration, always-on fixes for confirmed upstream Foundry bugs:
* **Token Resource Bar Refresh**: Fixes an upstream Foundry VTT V14 core issue where the first HP change of an unlinked token in a session (e.g. via the Token HUD) did not visually update its resource bar. Only applies to Foundry 14.369 and lower (fixed upstream in 14.370).
* **Placeables Sidebar Recovery**: Fixes an upstream Foundry VTT V14 core issue where one failed render of the Placeables sidebar's token list (for example caused by another module) pushed the sidebar to the left and broke it until reload, with the console error `Cannot read properties of null (reading 'replaceWith')`. The sidebar now recovers on its next update.
* **Region Effects on Deleted Tokens**: Fixes an upstream Foundry VTT V14 core issue where deleting an unlinked token (such as a slain enemy) that stood in a region with an **Apply Active Effect** behavior showed the error "undefined id [...] does not exist in the EmbeddedCollection collection". Foundry tried to remove the effect from the token after it was already deleted. Unlinked tokens are now skipped there; linked tokens still lose the effect as before.
* **File Picker Current File**: Fixes an upstream Foundry VTT V14 core issue where the file picker never highlighted the file that is currently set when it opens, e.g. a token's current image. The file is now marked (and scrolled to the middle of the list) until you pick another one. Turns itself off once Foundry fixes it.
* **macOS Canvas Performance**: Fixes an upstream Foundry VTT V14 / PIXI issue ([#14967](https://github.com/foundryvtt/foundryvtt/issues/14967)) where canvas FPS on Macs dropped steeply as tokens were added to a scene (around 20 FPS at 80 tokens). Only applies on macOS and to Foundry 14.370 and lower (fixed upstream in 14.371); Windows and Linux are unaffected by the bug and left alone.

---

## ⚙️ Settings Dashboard & Personal Preferences

All features of this module, and of system modules such as Nik's DnD5e Tweaks, are managed in one **Settings Dashboard**, opened from *Configure Settings → Nik's Foundry Tweaks → Configure Module*. When there are settings you haven't seen yet, that button shows how many.

**One row per feature**
* **Feature list**: Each feature is one row with a one-line summary and its on/off switch (or its main choice). Click the name to open it: the full description, its **Options for everyone**, and **On your screen**, the choices each player makes for themselves. Options stay locked while the feature is off. A small count on the row tells how many options a feature has.
* **Categories**: Features are grouped by topic (UI & Visuals, Canvas & Tokens, Combat Flow, Utilities & Debug); system modules add their features to the same categories and can add categories of their own. Each category shows how many of its features are on. The open feature panel says which module a feature comes from.
* **Search**: Finds features by name, description and related terms, including the options inside them. Words can be in any order. Matches are highlighted, a match inside an option opens the feature and marks the option, and every category with results shows how many it has. Press <kbd>Enter</kbd> to open the first one, <kbd>Esc</kbd> to clear the search.
* **Quick filters**: Show only features with something **Changed** from its default, something **New** since you last opened the dashboard, that are **Turned Off**, that **Need a Reload**, or that are **Handled Elsewhere** by another module. Filters combine with each other and with the search.
* **Docs**: *Read the docs* in a feature's panel opens its section of the module's README.

**Discovering features**
* **New since you last looked**: A note at the top says how many features have something new, with a link that shows only them. Categories with something new get a dot, and new features and options carry a **New** badge.
* **Your own choice**: When you turned a feature off for your own screen while it is on for everyone, its row says **Off for you**. Personal choices that only work while the GM has the feature on are dimmed when it is off. Choices that can override the GM (Readable Text Size, with **Use World Setting**) are not.
* **Deep links**: Macros and other modules can open the dashboard at a setting with `game.modules.get("niks-foundry-tweaks").api.openSettings("settingKey")`. Its feature opens and the setting is highlighted.

**Changing settings**
* **Changed from default**: A dot after the name marks a feature or option that differs from its default; the ↺ button next to an option puts it back, and *Reset this feature* in the panel resets the whole feature.
* **Unsaved changes**: Edited settings get a colored bar, and *Save* shows how many are pending. Closing the dashboard with unsaved changes asks first.
* **List settings**: Settings that hold a list of names (e.g. Auto-Apply Effects) open in their own editor, where you search, add and remove entries one by one. Some lists also offer a dropdown next to each entry (e.g. when Nik's DnD5e Tweaks removes an exception's template).
* **World Settings (GMs & Authorized Users)**: Fully supports Foundry's **"Modify Configuration Settings" (`SETTINGS_MODIFY`)** permission, so Assistant GMs or trusted players with that permission can change world settings like a GM.
* **Personal choices (All Players & GMs)**: Stored in your own browser. They sit inside each feature under **On your screen**, so players turn features off (or adjust them) for their own screen without changing anything for others. A few features exist only per screen, such as Toolbar Limitation; they are listed under **Just for You** in their category.
* **Players**: Players without settings permission see only the features they can change, each with their own switch on the row. Features the GM runs for everyone are listed at the end of each category under *Also active in this world*. *Reset my choices to defaults* resets only their personal settings.
* **Unavailable Settings**: Features that turn themselves off because another module handles the job are greyed out and locked, with a badge naming that module. Your stored choices are kept for when that module is turned off.
* **Backup**: *More → Export settings* saves the settings of every module in the dashboard to one file; *Import settings* loads them into a world. *Reset everything to defaults* is in the same menu. Exports made with Nik's DnD5e Tweaks before 14.70.0 can be imported too: the settings that moved here are restored here.

---

## 🧩 For Module Developers

System modules register into the dashboard and extend core features through the API. Register at the top level of your main script; core calls the hook once during its own `init`, after its settings are registered:

```js
Hooks.once("niksTweaks.register", (api) => {
    api.registerModule({ id: "my-module", title: "My Module", badge: "PF2", docsUrl: "https://github.com/me/my-module#" });
    api.registerSettings("my-module", [
        { id: "uiVisuals", sections: [{ id: "uiGeneral", settings: [
            { key: "enableFoo", introduced: "1.0.0", name: "Foo", hint: "…", type: "Boolean", default: true, scope: "world", docs: "foo" }
        ] }] }
    ]);
    api.extend("contextMenuStyling", { deleteLabels: ["MYSYS.Delete"] });
});
```

* Register the settings themselves with `game.settings.register` as usual; the schema only describes how the dashboard shows them.
* Your module doesn't need its own Configure Settings entry: the dashboard opens from Nik's Foundry Tweaks. If you want one anyway, register a menu with `type: api.SettingsApp` under the key `settingsDashboard` (it then shows the "N new" count too).
* Reuse core's tab and section ids to place settings next to related ones, or add your own tab (give it an `order`; core uses 0, 10, 20, 30 and 100 for Utilities & Debug).
* Extensions core reads: `contextMenuStyling` (`deleteLabels`, `duplicateLabels`, `violetLabels`, `backgroundVars`), `hidePrivateGMRolls` (`isRoll(message)`), `autoAddTokensToCombat` (`skipToken(tokenDocument)`), `carolingianHarmony` (`combatantClass(combatant)`), `readableTextSize` (`chat: true` when your stylesheet covers chat cards).
* Sync Check: `api.syncCheck.check()` compares this client with the server; `api.syncCheck.checkUsers(userIds?)` (GM) asks connected users to do the same.
* List settings (`list: true`, a comma-separated String) open the list editor. Add `choicePicker` to pick entries from known options instead: `{ getGroups: () => [{ label, value?, choices: [{ value, label, img?, children? }] }], mode?: "hide" | "select" | (readValue) => …, normalize?: (entry) => value|null, noun?, resetTitle? }`. `"hide"` shows eye icons (stored values are hidden), `"select"` checkboxes; a `mode` function gets `readValue(settingKey)` for the dashboard's unsaved value of another setting. Groups with a `value` get an "All …" toggle, and options under a picked group or option show as included. Entries that match no option are kept. Needs 14.7.0 (`api.API_VERSION` 2); older versions show the list editor.
* Teleport picker (API_VERSION 3): `api.teleportTargeting.isActive()` and `await api.teleportTargeting.pickDestination({ sourceToken, itemName?, range?, checkCollision?, customImg?, customImgScale? })` → `{ x, y, rotation, distance, center }` (top-left `x`/`y`), `null` when cancelled, `undefined` when it couldn't start. Extension `teleportTargeting`: `{ getTeleportInfo: ({ sourceToken, source }) => ({ range, itemName }) }` supplies range (scene units) and name for BLFX teleports.
* Helpers: `api.createContext({ moduleId, label, debugNamespace: "niks-foundry-tweaks" })` (logging, cached setting reads, feature checks following the shared Debug Mode) and `api.attachHudPositioning(element)` (keeps a floating banner centered on the visible canvas).

---

## 🤝 Module Compatibility

* **libWrapper**: All method and property overrides register cooperatively via `libWrapper` when installed, with a standalone fallback otherwise.
* **Carolingian UI**: Automatic color theme adoption for the dashboard and canvas banners, and top navigation clearance.
* **Automated Animations**: Ghost token preview (Dynamic Token Rings included) for teleport presets.
* **Boss Loot FX (BLFX)**: The same teleport banner and ghost preview replace BLFX's destination crosshair. Optional opacity for all BLFX animations.
* **Sequencer**: Templates fade while a Sequencer animation plays on them.
* **Nik's DnD5e Tweaks**: Requires this module from 14.70.0 on and adds its settings to the dashboard. With an older Nik's DnD5e Tweaks active, this module stays inactive (and tells the GM to update), so no feature runs twice.

---

## 🌐 Languages

🇬🇧 English · 🇩🇪 Deutsch · 🇫🇷 Français (thanks Kameleau)

Translations into other languages by native speakers are welcome as an issue or pull request.

---

## 📦 Installation

### Via Foundry VTT Package Browser
1. In the Foundry setup menu, navigate to **Add-on Modules** > **Install Module**.
2. Search for **Nik's Foundry Tweaks**.
3. Click **Install**.

### Via Manifest URL
Paste the following manifest URL into Foundry's **Manifest URL** field:
```
https://github.com/nschoenwald/niks-foundry-tweaks/releases/latest/download/module.json
```

### Requirements
* **Foundry VTT**: Version 14 (maximum 14)
* Works with any game system.

---

## ❤️ Modules by Nik

### 🧩 Nik's Tweaks
* **[Nik's Foundry Tweaks](https://github.com/nschoenwald/niks-foundry-tweaks)** – System-independent quality-of-life tweaks and the shared settings dashboard of Nik's Tweaks modules.

### 🎲 D&D 5e Specific
* **[Nik's DnD5e Tweaks](https://github.com/nschoenwald/niks-dnd5e-tweaks)** – Consolidated collection of quality-of-life enhancements and combat automation tweaks for DnD5e.
* **[Nik's Give & Take](https://github.com/nschoenwald/niks-give-and-take)** – Players hand items and money to other characters and the party, and take them from the party's stash.

### ⚔️ Combat & Token Tools
* **[Nik's Action HUD](https://github.com/nschoenwald/niks-action-hud)** – Sleek, modern canvas-docked Action HUD for quick access to attacks, spells, inventory, and utility rolls.
* **[Nik's Effects Panel](https://github.com/nschoenwald/niks-effects-panel)** – Floating panel next to the sidebar that shows the selected token's active effects, to check, disable or remove them without opening the character sheet.
* **[Nik's Token Tags](https://github.com/nschoenwald/niks-token-tags)** – Automatically numbers duplicate combatant NPCs (A, B, C…) with color-coded letter overlays.
* **[Nik's Shared NPC Initiative](https://github.com/nschoenwald/niks-shared-npc-initiative)** – Groups NPCs of the same type in combat so they share a single initiative roll.
* **[Nik's Movement Control](https://github.com/nschoenwald/niks-movement-control)** – GM controls to toggle player movement and automatically restrict/allow movement on combat start and end.
* **[Nik's Token Motion](https://github.com/nschoenwald/niks-token-motion)** – Tokens hop square by square like miniatures, lift and set down like chess pieces, or glide smoothly, and long moves no longer crawl across the map.
* **[Nik's Tiny Change Logs](https://github.com/nschoenwald/niks-tiny-changelogs)** – Compact, single-line chat messages logging token HP and Temp HP changes.

### 🎨 Visuals & Display
* **[Nik's Dynamic Roll Area](https://github.com/nschoenwald/niks-dynamic-roll-area)** – Dynamically restricts Dice So Nice 3D dice rolling area to exclude the sidebar / chat log across all screen resolutions and window sizes.

### ⚙️ Utilities & System Management
* **[Nik's Settings Locks](https://github.com/nschoenwald/niks-settings-locks)** – Soft-lock and hard-lock client settings and keybindings across all connected players.
* **[Nik's Compendium Search Tweaks](https://github.com/nschoenwald/niks-compendium-search-tweaks)** – Configure which compendium packs are included or excluded from native sidebar search.
* **[Nik's Copy Environment](https://github.com/nschoenwald/niks-copy-environment)** – Copy the list of systems, modules, and versions, and export/import game and player settings.
* **[Nik's Show & Tell](https://github.com/nschoenwald/niks-show-and-tell)** – Share popout images to chat and paste image files directly into chat messages.
* **[Nik's Zoom / Pan Options](https://github.com/nschoenwald/niks-zoom-pan-options)** – Touchpad and scroll wheel pan/zoom controls and canvas navigation enhancements.
* **[Nik's Scene Transformations](https://github.com/nschoenwald/niks-scene-transformations)** – Rotate scenes or add playable space around them, with tokens, walls, lights, tiles and regions moved along so everything stays in place.
* **[Nik's Wall Height](https://github.com/nschoenwald/niks-wall-height)** – Give walls a bottom and top elevation, so tokens, lights and sounds above or below a wall ignore it.
* **[Nik's Scene Defaults](https://github.com/nschoenwald/niks-scene-defaults)** – Set your own defaults for new scenes (grid, vision, fog, lighting, background and more), so you don't have to change them on every scene.
