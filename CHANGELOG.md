# Changelog

## 0.8.3 (2026-11-25)

- Expanded map analysis with resilient optional environment and terrain handling, additional views, and improved province details and labels.
- Improved file inspector tree layout, comment readability, and scrolling for large and wide files.
- Added bounded mousewheel zoom, free orbit/roll rotation, and right-drag panning to the 3D viewer, with lifecycle cleanup.
- Work around Firefox's deterministic +1 red-channel shift for 46 province colours during image-to-canvas decoding by using a unique `(r-1, g, b)` definition match when exact RGB matching fails.

## 0.8.2 (Firefox port release)

- Ported JoroDox Tools to Firefox as a Manifest V3 extension.

## 0.8.1 (2023-07-12, Chrome extension baseline)

- Made the extension icon clickable after the tool stopped being a Chrome App.
