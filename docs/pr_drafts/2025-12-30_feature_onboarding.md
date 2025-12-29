# PR: Onboarding Tutorial

## Summary
Adds a first-run tutorial overlay to guide new users through the extension's features.

## Changes
-   **Content Script**:
    -   Added `releaf_hasSeenTutorial` check in local storage.
    -   Implemented a 3-step overlay tutorial:
        1.  **Welcome & Navigation**: Shows "Prev" and "Next" tap zones. (Center zone removed to avoid overlap).
        2.  **Settings**: Text instructions for customization.
        3.  **Exit**: Text instructions for closing.
    -   Added **"Don't show again"** checkbox.
    -   **Branding**: Uses official extension logo (`src/assets/logo.png`) in header.
    -   Logic: Flag is saved ONLY IF user completes the tour OR explicitly checks "Don't show again".
-   **Manifest**:
    -   Added `web_accessible_resources` to allow loading the logo in the content script.
-   **Styles**:
    -   Added dark overlay and card styles (zIndex 9999).
    -   Improved text contrast (Bold color inherits from parent).
    -   Aligned logo vertically in tutorial header.
-   **Tests**:
    -   Added test case to verify tutorial launches when storage flag is missing.
    -   Verified UI elements (checkbox) exist.

## Checklist
-   [x] Tutorial appears on first run.
-   [x] User can opt-out via checkbox.
-   [x] "Prev/Next" zones are clearly visible.
-   [x] Branding uses official logo (Fixed 404 error).
