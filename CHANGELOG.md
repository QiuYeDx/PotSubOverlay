# Changelog

All notable changes to PotSubOverlay are documented in this file.

## [1.1.0] - 2026-10-08

### Added

- Bilingual subtitles in any language pair: Chinese, Japanese, Korean, English, French, German, Spanish, Portuguese, Italian, Russian, Thai, Vietnamese and Arabic are recognised, and file tags such as `chseng`, `zh-en` or `中英双语` are understood.
- Primary language setting (default Chinese); the two lines are styled as primary / second language, with an automatic font per language.
- Tray menu drawn in the app's own style, following the app theme, with keyboard navigation.

### Changed

- Defaults: 30px primary text, 24px second-language text, 1.5px outline (untouched 1.0 values are migrated).
- Language mode reads Both / <primary> / <second> with real language names, also in the tray menu.

### Fixed

- Compact mode: expand and close buttons could not be clicked while no subtitle was showing.
- Showing or hiding subtitles could stutter; the overlay now fades in the page instead of hiding the window.
- The font list no longer runs past the bottom of the window; it shrinks or opens above the field.
- Even corner insets for the compact-mode button and the theme toggle.

## [1.0.0] - 2026-10-08

### Added

- Follows PotPlayer through its window-message API: position, duration, play state and the full path of the current file; several PotPlayer windows are supported with automatic or manual selection.
- Loads same-name subtitles from the media folder (`.srt`, `.ass`, `.ssa`, `.vtt`, `.lrc`, including `name.<tag>.ext` and `name.mp4.ext`), detects UTF-8/16, GBK, Shift-JIS and Big5, and reloads when the folder changes.
- Bilingual display in two lines: single-file bilingual subtitles and separate Chinese/Japanese files, Chinese on top by default, with Both / Chinese only / Japanese only modes.
- Transparent, always-on-top, click-through subtitle overlay with an edit mode for dragging, resizing and multi-display placement.
- Control panel with full and compact layouts, live preview, per-language typography, outline, shadow and backing-plate styles.
- Global shortcuts, tray menu, launch at login, per-file timing offset, and Simplified Chinese, Traditional Chinese, English and Japanese UI.
