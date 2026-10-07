# Changelog

All notable changes to PotSubOverlay are documented in this file.

## [1.0.0] - 2026-10-08

### Added

- Follows PotPlayer through its window-message API: position, duration, play state and the full path of the current file; several PotPlayer windows are supported with automatic or manual selection.
- Loads same-name subtitles from the media folder (`.srt`, `.ass`, `.ssa`, `.vtt`, `.lrc`, including `name.<tag>.ext` and `name.mp4.ext`), detects UTF-8/16, GBK, Shift-JIS and Big5, and reloads when the folder changes.
- Bilingual display in two lines: single-file bilingual subtitles and separate Chinese/Japanese files, Chinese on top by default, with Both / Chinese only / Japanese only modes.
- Transparent, always-on-top, click-through subtitle overlay with an edit mode for dragging, resizing and multi-display placement.
- Control panel with full and compact layouts, live preview, per-language typography, outline, shadow and backing-plate styles.
- Global shortcuts, tray menu, launch at login, per-file timing offset, and Simplified Chinese, Traditional Chinese, English and Japanese UI.
