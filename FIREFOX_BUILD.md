# Firefox build and packaging

Firefox is the primary target. The source `manifest.json` is Firefox Manifest V3 and can be loaded temporarily for local development. The reproducible package builder injects the permanent Gecko add-on ID `jorodox-tool-firefox@jorodox-tool` by default.

## Build

Requirements: Python 3; no npm, Bower, or network access is required. The builder packages checked-in Bower files referenced by the extension pages and styles, including CSS-referenced assets; it does not resolve dependencies or include unused package demos/tests. Do not run `bower install` as part of a release build.

```sh
python3 scripts/build_firefox.py
```

The builder's `--gecko-id` option can override the default when intentionally building a different add-on.

By default this writes `dist/JoroDoxTools-0.8.3-firefox.zip`. Override the destination with `--output path/to/package.zip`. The script validates the Gecko ID, normalizes CRLF to LF in packaged text files, emits a sorted archive with fixed timestamps and stored (uncompressed) entries, tests the ZIP, and prints its SHA-256. This makes builds reproducible across Git checkouts with different line-ending settings, provided file contents and the Gecko ID are otherwise identical.

To load the package temporarily, extract it and select the extracted `manifest.json` through `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**. Temporary installation is for development and does not sign the add-on. Release and Beta Firefox require Mozilla signing, including self-distributed packages.

Optional manifest lint, using a locally installed Firefox WebExtension linter:

```sh
web-ext lint --source-dir path/to/extracted-package
```

## Firefox-specific manifest decisions

- **Manifest V3 background:** `background.scripts` with `persistent: false` is used for Firefox’s event-page background. Firefox does not support `background.service_worker`; the old Chrome module service worker has been replaced by [background.js](./background.js).
- **Stable Gecko ID:** `browser_specific_settings.gecko.id` is injected by the builder as `jorodox-tool-firefox@jorodox-tool`. AMO checks uniqueness. Keep the same ID for all releases.
- **Version support:** `strict_min_version` is `140.0`; `strict_max_version` is omitted so later Firefox releases are not artificially blocked. Firefox 160.0.1 is the version manually tested; Firefox 140.0 itself has not been separately tested. Firefox ESR is not claimed as supported.
- **Data collection declaration:** The manifest says `required: ["none"]`. This reflects the current implementation’s local-only file processing and storage; it must be changed if telemetry or other data transmission outside the extension is added. New AMO submissions have required data-collection metadata since November 3, 2025.
- **Least privilege:** The extension requests only `storage`. It does not declare host permissions, `downloads`, or native messaging. ZIP download uses a local Blob URL and anchor rather than the downloads API.
- **Local code and CSP:** Scripts and dependencies are packaged locally. Do not introduce remotely hosted executable code or weaken the extension-page CSP.
- **Firefox-specific API use:** [background.js](./background.js) uses `browser.action` and `browser.windows`. The page continues using the Firefox-supported `chrome.*` compatibility namespace for existing callback-style storage/runtime calls.

### Minimum-version rationale

Firefox 140.0 is the lowest appropriate manifest minimum. The required `browser_specific_settings.gecko.data_collection_permissions` declaration was added in Firefox 140; new AMO submissions have been required to include the data-collection declaration since November 3, 2025. The main runtime API floor is lower: Manifest V3 and `browser.action` are supported from Firefox 109, while the used `browser.windows.create`, runtime, storage, and event-page background-script APIs predate that. The app checks for `window.showDirectoryPicker` before using it and otherwise uses the directory `<input webkitdirectory>` workflow, so that optional File System Access API branch does not raise Firefox's minimum.

## Reproducibility and release checks

1. Build twice from the same checkout using the configured Gecko ID; compare the printed SHA-256 values.
2. Verify the archive with `python3 -m zipfile -t dist/JoroDoxTools-0.8.3-firefox.zip`.
3. Extract it and load the extracted manifest in Firefox 160.0.1. Confirm the toolbar action opens the UI and that no packaged resource is missing.
4. `web-ext lint` 10.8.0 reported zero errors and 13 warnings on the current Firefox 140.0 package: 12 upstream-library warnings and one Android-only minimum-version warning. The app-owned `innerHTML` warning is gone; mod YAML reads use js-yaml's safe loader. See [FIREFOX_AMO_LINT_AUDIT.md](./FIREFOX_AMO_LINT_AUDIT.md) for the warning-by-warning review; lint success alone is not proof of safety.
5. Firefox 160.0.1 was reported as current stable on 2026-11-22 and has been used for manual validation. Test future stable releases as they become available before making claims about those versions. Test ESR separately before adding it to the support policy.
6. Submit the built package for Mozilla signing before distributing it to Firefox Release/Beta users.

The package builder uses checked-in dependencies rather than resolving Bower ranges at build time. Dependency upgrades must therefore be deliberate source changes followed by the same browser test matrix. The previously linted verification package used a placeholder Gecko ID; rebuild and lint with the configured permanent ID before submission.

## Mozilla references

- [Manifest background scripts and service-worker support](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [Gecko ID, strict version range, and data-collection manifest fields](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
- [Firefox built-in data-collection consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
- [Manifest V3 API support in Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/manifest_version)
- [Firefox `browser.action` API compatibility](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action)
- [Firefox `windows.create()` API compatibility](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/windows/create)
- [Mozilla signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [web-ext commands, including lint](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
