# Changelog

All notable changes to this project will be documented in this file.

## [14.3.2] - 2026-11-13
### Fixed
- **Reliable Chat Log Auto-Scroll**: The chat log no longer stops following new messages in busy moments. When a card grew right as it was posted (trays opening, dice revealed after the 3D roll, cards updated by automation modules), the chat could think you had scrolled up and stay put until you scrolled down by hand. Now only your own scrolling stops it, and scrolling back to the bottom resumes it. It also catches up when you expand the collapsed sidebar.

## [14.3.1] - 2026-11-12
### Changed
- **Clearer Scene Control Toggles**: Toggles that are off and tools that aren't selected are dimmed less, so their icons stay easier to recognize while on toggles and the selected tool still stand out.

## [14.3.0] - 2026-11-11
### Added
- **Clearer Scene Control Toggles**: On/off toggles in the left toolbar (such as Force Snap to Grid Vertices or Unconstrained Movement) are now easy to tell apart. Toggles that are off are dimmed, toggles that are on get a colored ring and a small colored dot, and hovering no longer makes an off toggle look on. Choice tools such as Select or Draw Walls work the same way: the selected one gets the colored ring, the others are dimmed. Works in light and dark themes and with Carolingian UI, following its color theme. On by default; players can turn it off for themselves.

## [14.2.2] - 2026-11-08
### Changed
- **Performance features**: Players can now turn each performance feature on for themselves even if the GM left it off, not only off. Their personal setting offers **Use World Setting** (the default, follows the GM), **On** and **Off**. Anyone who had turned a feature off keeps it off.

### Fixed
- **Settings Dashboard**: The personal Readable Text Size settings are no longer greyed out with "your choice has no effect" when the GM's setting is off. Your choice always applied; only the dashboard said otherwise.

## [14.2.1] - 2026-11-08
### Changed
- **Performance settings**: The five performance features from 14.2.0 now have their own **Performance** tab in the Settings Dashboard, and the players' personal options for them are grouped in one Performance section under Personal Preferences. Nothing else changes: your settings stay as they are.

## [14.2.0] - 2026-11-08
### Added
- **Lightweight Chat & Sidebar Lists**: Long chat logs and large directories scroll and update faster. The browser skips drawing chat messages and sidebar entries that are out of view. Nothing changes visually. Off by default for now: the GM can turn it on in the Settings Dashboard, and players can turn it off for themselves.
- **Batched Sidebar Updates (Experimental)**: The Combat Tracker and sidebar directories no longer redraw again and again in busy moments. An area spell damaging many creatures redraws the Combat Tracker once instead of once per creature, closed sidebar tabs catch up when you open them, and hit point changes no longer rebuild the Actors folder list. Experimental and off by default: if the Combat Tracker or a directory shows outdated information with it on, turn it off and let me know.
- **Idle Frame Rate**: The canvas can drop to a lower frame rate while nobody does anything and nothing moves, and returns to normal on the next mouse movement, key press, token movement or chat message. Saves battery, heat and fan noise. Off by default; players can turn it off and choose the idle frame rate for themselves.
- **Throttled Vision Updates While Moving (Experimental)**: Smoother token movement in scenes with many walls: a moving token's vision and light are recalculated a limited number of times per second instead of every frame, and exactly at the end of the move. Experimental and off by default.
- **Lighter Video Playback**: Animated maps, tiles and tokens stop updating while they are off screen, and can optionally be limited to fewer frames per second. Videos keep playing, so timing and sound don't change. Off by default; players can turn it off and set the limit for themselves.
- All of the new performance features work together with Prime Performance.

## [14.1.2] - 2026-11-07
### Fixed
- **macOS Canvas Performance**: On Macs, the canvas no longer slows down more and more as tokens are added to a scene. Scenes with dozens of tokens that ran at 20–50 FPS now run at the display's full refresh rate again. Nothing changes on Windows or Linux.

## [14.1.1] - 2026-11-07
### Fixed
- **Hide Private GM Rolls from Players**: No more libWrapper warning that Nik's Foundry Tweaks and Nik's DnD5e Tweaks "modify the same FoundryVTT functionality" when chat messages are shown. Private GM rolls stay hidden exactly as before.

## [14.1.0] - 2026-11-07
### Added
- **French translation**: The module is now available in French, reviewed by Kameleau. Thank you!

## [14.0.0] - 2026-11-06
### Added
- **Nik's Foundry Tweaks**: First release. The system-independent features of Nik's DnD5e Tweaks now live in this module, so they work in any game system: Readable Text Size, Sheet Pop-out Button, Clean Sheet Window Titles, Context Menu Styling, Reliable Chat Log Auto-Scroll, Hide Private GM Rolls from Players, Actor Directory Disposition Dots, Sidebar Multi-line Names, Sync Browser Tab Title, Toolbar Limitation, Carolingian UI Theme Harmony, Clear Targets Token Control Button, Disable Underground Token Hiding, Enhanced Teleport Targeting UI, Auto-Add Tokens to Combat, Auto-Unpause When Logging In and Debug Mode, plus two fixes for Foundry bugs.
- **Settings Dashboard**: The dashboard moved here too and is now shared: Nik's DnD5e Tweaks (from 14.70.0) adds its settings to the same window, marked with a small **5e** badge. It is called **Nik's Tweaks** now.
- **Settings carry over**: The first time a world loads with this module, the settings of these features are copied over from Nik's DnD5e Tweaks: world settings, each GM's auto-unpause choice, and each player's personal preferences. Settings you haven't changed keep their defaults, and "New" badges don't light up for settings you already knew.
- **Backups**: Settings exports made with older versions of Nik's DnD5e Tweaks can be imported here; the moved settings are restored in this module.
- **Older Nik's DnD5e Tweaks**: While a Nik's DnD5e Tweaks older than 14.70.0 is active, this module does nothing and asks the GM to update, so no feature runs twice.
