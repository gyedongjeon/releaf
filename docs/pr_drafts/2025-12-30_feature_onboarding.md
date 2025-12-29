# PR: Onboarding Tutorial

## Summary
Adds a first-run tutorial overlay to guide new users through the extension's features.

## Changes
-   **Content Script**:
    -   Added `releaf_hasSeenTutorial` check in local storage.
    -   Implemented a 3-step overlay tutorial:
        1.  **Welcome & Navigation**: Shows "Prev", "Next", and **"Menu" (Center)** tap zones.
        2.  **Settings**: Text instructions for customization.
        3.  **Exit**: Text instructions for closing.
    -   Added **"Don't show again"** checkbox.
    -   Logic: Flag is saved ONLY IF user completes the tour OR explicitly checks "Don't show again".
-   **Styles**:
    -   Added dark overlay and card styles (zIndex 9999).
    -   Added styles for `.releaf-zone-center`.
    -   Improved text contrast (Bold = Black).
-   **Tests**:
    -   Added test case to verify tutorial launches when storage flag is missing.
    -   Verified UI elements (checkbox) exist.

## Checklist
-   [x] Tutorial appears on first run.
-   [x] User can opt-out via checkbox.
-   [x] "Menu" zone is clearly visible.
-   [x] Instructions are easy to read.
-   [x] **Simplified Layout**: Removed complex element highlighting to prevent visual bugs.
