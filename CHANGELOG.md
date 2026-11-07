# Changelog

All notable changes to this project will be documented in this file.

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
