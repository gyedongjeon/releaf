# PR: Settings Persistence

## Summary
Implements persistence for user settings (Theme, Font Size, Line Height, Margins, Page View). Settings are saved to `chrome.storage.sync` whenever changed and automatically applied when Reader Mode is activated.

## Changes
-   **Manifest**: Added `storage` permission.
-   **Content Script**:
    -   Added `loadSettings()` helper to retrieve and apply values on startup.
    -   Added `saveSetting(key, value)` helper.
    -   Updated all setting controls (swatches, sliders, buttons) to trigger `saveSetting` on change.
-   **Tests**:
    -   Updated `test/content.test.js` to mock `chrome.storage.sync`.
    -   Added test case verifying `set` is called when controls are interacted with.

## Checklist
-   [x] Feature works as expected.
-   [x] All tests passed.
