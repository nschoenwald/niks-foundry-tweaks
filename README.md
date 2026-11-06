# Nik's Foundry Tweaks

[![Foundry VTT](https://img.shields.io/badge/Foundry%20VTT-V14-orange.svg)](https://foundryvtt.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/nschoenwald/niks-foundry-tweaks?color=purple)](https://github.com/nschoenwald/niks-foundry-tweaks/releases/latest)

System-independent quality-of-life tweaks for **Foundry VTT (v14)**, and the home of the **Nik's Tweaks settings dashboard**, which system modules like [Nik's DnD5e Tweaks](https://github.com/nschoenwald/niks-dnd5e-tweaks) share.

---

> [!TIP]
> **Modular by Design**: Every tweak can be toggled independently. GMs configure world defaults, while players have their own **Personal Preferences** tab to adjust features for their own screen.

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
| **[Sync Browser Tab Title](#sync-browser-tab-title)** | UI & Visuals | ✅ Enabled | Yes |
| **[Toolbar Limitation](#toolbar-limitation)** | UI & Visuals | ✅ Enabled | Yes |
| **[Carolingian UI Theme Harmony](#carolingian-ui-theme-harmony)** | UI & Visuals | ✅ Enabled | Yes |
| **[Clear Targets Token Control Button](#clear-targets-token-control-button)** | Canvas & Tokens | ✅ Enabled | Yes |
| **[Disable Underground Token Hiding](#disable-underground-token-hiding)** | Canvas & Tokens | ❌ Disabled | No |
| **[Enhanced Teleport Targeting UI](#enhanced-teleport-targeting-ui-automated-animations)** | Canvas & Tokens | ✅ Enabled | Yes |
| **[Auto-Add Tokens to Combat](#auto-add-tokens-to-combat)** | Combat Flow | ✅ Enabled | No |
| **[Auto-Unpause When Logging In](#auto-unpause-when-logging-in)** | Utilities | ❌ Disabled | Yes (GM) |
| **[Debug Mode](#debug-mode)** | Utilities | ❌ Disabled | No |

---

## 🎨 UI & Visuals

### Readable Text Size
Enlarges body text and adds space between lines, without making the rest of the interface bigger the way Foundry's **Font Size** setting does.
* **Covers**: journal pages (while reading and while editing). System modules extend it to their sheets, tooltips and chat cards; with [Nik's DnD5e Tweaks](https://github.com/nschoenwald/niks-dnd5e-tweaks), that is item descriptions, biographies, items expanded on a sheet and item tooltips. Headings scale along; buttons and the rest of the interface keep their size.
* **Levels**: **Comfortable** (default, journals 14px → 16px), **Large** (journals 18px), or **Off** for the system's own sizes. Both still follow Foundry's Font Size setting.
* **Chat Cards**: With a system module that supports it (such as Nik's DnD5e Tweaks), **Readable Text Size in Chat Cards** also enlarges descriptions inside chat cards (off by default, as it makes cards taller). Without one, the option is hidden.
* **World Default & Personal Override**: The GM picks the size (and the chat card option) for everyone. Each player can override both under Personal Preferences; their default is **Use World Setting**.

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
Keeps the chat log scrolled to the bottom when new cards appear, trays expand or images load after the fact, while preserving your scroll position when you are reading older messages.

### Hide Private GM Rolls from Players
Whispered, private and blind rolls made by the GM no longer show up for players as empty placeholder cards in the chat log. System modules can mark their own roll cards, so system rolls are hidden too.

### Actor Directory Disposition Dots
Displays colored disposition dots (Friendly, Neutral, Hostile, Secret) next to actor names in the sidebar.

### Sidebar Multi-line Names
Long names of actors, items, scenes and other documents in the right sidebar wrap onto several lines instead of being cut off.

### Sync Browser Tab Title
Dynamically updates the browser tab title with the name of the active scene being viewed.

### Toolbar Limitation
Turns toolbars scrollable when button count exceeds a configured limit (default: 20), preventing overcrowded canvas controls. Layout is recalculated after the window has finished resizing.

### Carolingian UI Theme Harmony
Adapts the Settings Dashboard and floating canvas banners to **Carolingian UI** color palettes, typography and top scene navigation offsets. System modules add their own parts (with Nik's DnD5e Tweaks: chat cards, template and summoning HUDs, and legendary action placeholders in the Combat Carousel).

---

## 🎯 Canvas & Tokens

### Clear Targets Token Control Button
Adds a dedicated crosshair button to the canvas Token Controls toolbar, positioned directly below the core Select Targets button. Players clear their own targets; GMs clear targets across the entire canvas simultaneously.

### Disable Underground Token Hiding
Prevents tokens with negative elevation from disappearing behind the scene background layer.

### Enhanced Teleport Targeting UI (Automated Animations)
Improves teleport preset destination picking (*Misty Step*, *Dimension Door*):
* Snaps a translucent ghost token preview to the grid featuring the character's authentic dynamic token ring and rune colors.
* Real-time status badges for valid range, out-of-range, and wall collision.
* Uninterrupted right-click canvas panning and clean <kbd>ESC</kbd> / Cancel flow.

---

## 🏁 Combat Flow

### Auto-Add Tokens to Combat
Tokens created or dragged onto the scene while a combat is running are added to the combat automatically. System modules can leave some tokens out (Nik's DnD5e Tweaks leaves out summoned creatures).

---

## 🔧 Utilities

### Auto-Unpause When Logging In
Per-user GM setting to automatically unpause the world upon login (**Always**, **When no players connected**, or **Never**).

### Debug Mode
Enables diagnostic logging in the browser console, for this module and every Nik's Tweaks module that uses the dashboard.

---

## 🛠️ Silent Core Patches

Patches are zero-configuration, always-on fixes for confirmed upstream Foundry bugs:
* **Token Resource Bar Refresh**: Fixes an upstream Foundry VTT V14 core issue where the first HP change of an unlinked token in a session (e.g. via the Token HUD) did not visually update its resource bar. Only applies to Foundry 14.369 and lower (fixed upstream in 14.370).
* **Placeables Sidebar Recovery**: Fixes an upstream Foundry VTT V14 core issue where one failed render of the Placeables sidebar's token list (for example caused by another module) pushed the sidebar to the left and broke it until reload, with the console error `Cannot read properties of null (reading 'replaceWith')`. The sidebar now recovers on its next update.

---

## ⚙️ Settings Dashboard & Personal Preferences

All features of this module, and of system modules such as Nik's DnD5e Tweaks, are managed in one **Settings Dashboard**, opened from *Configure Settings → Nik's Foundry Tweaks → Configure Module*. When there are settings you haven't seen yet, that button shows how many.

**Finding settings**
* **Overview**: The first tab shows every feature as a card with a one-line summary, whether it is on, and a switch to turn it on or off. Click a feature's name to jump to all its options.
* **Tabs**: Settings are grouped by topic (UI & Visuals, Canvas & Tokens, Combat Flow, Utilities & Debug, and Personal Preferences); system modules add their settings to the same tabs and can add tabs of their own. Settings from a system module carry a small badge (e.g. **5e**).
* **Search**: Finds settings by name, description and related terms. Words can be in any order. Matches are highlighted and every tab with results shows how many it has. Press <kbd>Enter</kbd> to jump to the first one, <kbd>Esc</kbd> to clear the search.
* **Quick filters**: Show only settings that are **Changed** from their default, **New** since you last opened the dashboard, **Turned Off**, that **Need a Reload**, or that are **Handled Elsewhere** by another module. Filters combine with each other and with the search.
* **Short or full descriptions**: Descriptions take one line by default; click one to read it in full, or switch to full descriptions in the header.
* **Docs**: The ⓘ next to a feature (and *Docs* on its card) opens its section of the module's README.

**Discovering features**
* **New since you last looked**: The Overview lists settings added since you last opened the dashboard, they carry a **New** badge, and each tab shows how many new settings it holds.
* **World and personal settings are linked**: A world setting that players can change for themselves shows *Personal: …* with your own choice; the personal setting shows *World: …* and is dimmed when the world setting is off, since it has no effect then. Click either to jump to the other.
* **Deep links**: Macros and other modules can open the dashboard at a setting with `game.modules.get("niks-foundry-tweaks").api.openSettings("settingKey")`.

**Changing settings**
* **Changed from default**: A dot after the name marks a setting that differs from its default; the ↺ button next to it puts it back.
* **Unsaved changes**: Edited settings get a colored bar, and *Save Changes* shows how many are pending. Closing the dashboard with unsaved changes asks first.
* **World Settings (GMs & Authorized Users)**: Fully supports Foundry's **"Modify Configuration Settings" (`SETTINGS_MODIFY`)** permission, so Assistant GMs or trusted players with that permission can change world settings like a GM.
* **Personal Preferences (All Players & GMs)**: Settings stored in your own browser. Players turn features on or off for their own screen without changing anything for others. For GMs this tab is at the bottom.
* **Players**: Players without settings permission see their Personal Preferences first and an **Active in This World** tab that lists the features the GM turned on, each linked to their own choice. "Reset Defaults" resets only their personal settings.
* **Unavailable Settings**: Settings for features that turn themselves off because another module handles the job are greyed out and locked, with a badge naming that module. Your stored choice is kept for when that module is turned off.
* **Backup**: *Export JSON* saves the settings of every module in the dashboard to one file; *Import JSON* loads them into a world. Exports made with Nik's DnD5e Tweaks before 14.70.0 can be imported too: the settings that moved here are restored here.

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
* Helpers: `api.createContext({ moduleId, label, debugNamespace: "niks-foundry-tweaks" })` (logging, cached setting reads, feature checks following the shared Debug Mode) and `api.attachHudPositioning(element)` (keeps a floating banner centered on the visible canvas).

---

## 🤝 Module Compatibility

* **libWrapper**: All method and property overrides register cooperatively via `libWrapper` when installed, with a standalone fallback otherwise.
* **Carolingian UI**: Automatic color theme adoption for the dashboard and canvas banners, and top navigation clearance.
* **Automated Animations**: Ghost token preview with dynamic token rings for teleport presets.
* **Nik's DnD5e Tweaks**: Requires this module from 14.70.0 on and adds its settings to the dashboard. With an older Nik's DnD5e Tweaks active, this module stays inactive (and tells the GM to update), so no feature runs twice.

---

## 🌐 Languages

🇬🇧 English · 🇩🇪 Deutsch

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
