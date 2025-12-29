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
    -   Added **"Don't show again"** checkbox.
    -   Logic: Flag is saved ONLY IF user completes the tour OR explicitly checks "Don't show again".
-   **Styles**:
    -   Added dark overlay and card styles.
    -   Added `releaf-highlight` animation (pulsing ring).
    -   Added Checkbox and Close button styles.
-   **Tests**:
    -   Added test case to verify tutorial launches when storage flag is missing.
    -   Verified UI elements (checkbox) exist.

## Checklist
-   [x] Tutorial appears on first run.
-   [x] User can opt-out via checkbox.
-   [x] UI elements (Gear, Close) are correctly highlighted.
