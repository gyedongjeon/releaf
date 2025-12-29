# PR: Onboarding Tutorial

## Summary
Adds a first-run tutorial overlay to guide new users through the extension's features.

## Changes
-   **Content Script**:
    -   Added `releaf_hasSeenTutorial` check in local storage.
    -   Implemented a 3-step overlay tutorial:
        1.  **Welcome & Navigation**: Shows "Prev/Next" tap zones.
        2.  **Settings**: Highlights the settings gear.
        3.  **Exit**: Highlights the close button.
-   **Styles**:
    -   Added dark overlay and card styles.
    -   Added `releaf-highlight` animation (pulsing ring) to draw attention to UI elements.
-   **Tests**:
    -   Added test case to verify tutorial launches when storage flag is missing.

## Checklist
-   [x] Tutorial appears on first run.
-   [x] Tutorial does not appear on subsequent runs (simulated).
-   [x] UI elements (Gear, Close) are correctly highlighted.
