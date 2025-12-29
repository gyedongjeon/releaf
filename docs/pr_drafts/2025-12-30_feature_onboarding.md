# PR: Onboarding Tutorial

## Summary
Adds a first-run tutorial overlay to guide new users through the extension's features.

## Changes
-   **Content Script**:
    -   Added `releaf_hasSeenTutorial` check in local storage.
    -   Implemented a 3-step overlay tutorial:
        1.  **Welcome & Navigation**: Shows "Prev", "Next", and **"Menu" (Center)** tap zones.
        2.  **Settings**: Highlights the settings gear.
        3.  **Exit**: Highlights the close button.
    -   Added **"Don't show again"** checkbox.
    -   Logic: Flag is saved ONLY IF user completes the tour OR explicitly checks "Don't show again".
-   **Styles**:
    -   Added dark overlay and card styles (zIndex 9999).
    -   Added `releaf-highlight` animation (zIndex 10002).
    -   Added CSS `:has` selector to lift the `bottom-menu` zIndex when highlighted.
    -   Added styles for `.releaf-zone-center`.
    -   Improved text contrast for instructions (Bold text is now Dark Black).
-   **Tests**:
    -   Added test case to verify tutorial launches when storage flag is missing.
    -   Verified UI elements (checkbox) exist.

## Checklist
-   [x] Tutorial appears on first run.
-   [x] User can opt-out via checkbox.
-   [x] "Menu" zone is clearly visible.
-   [x] Instructions are easy to read (High Contrast).
-   [x] Settings gear pops out above the overlay.
