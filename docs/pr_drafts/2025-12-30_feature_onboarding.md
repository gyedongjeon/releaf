# PR: Onboarding Tutorial & Extraction Fixes

## Summary
Adds a first-run tutorial overlay and refines content extraction for Korean news sites.

## Changes
-   **Content Script**:
    -   **Fix**: Added filters for Daum/Naver News utility menus (TTS, Font settings).
    -   **Fix**: Added filters for Daum News **Footers & Related Articles**.
    -   **Fix**: Improved extraction for Donga.com (ignores short metadata blocks).
    -   **Fix**: 2-Page View now allows empty columns on the last page.
        -   Uses `padding-right: 50vw` to prevent "stuck" scrolling or content duplication on the final page.
    -   Added `releaf_hasSeenTutorial` check.
    -   Implemented a 3-step overlay tutorial.
    -   Branding: Uses official extension logo (`src/assets/logo.png`).
-   **Styles**:
    -   Added dark overlay and card styles.
    -   Aligned logo vertically.
-   **Manifest**:
    -   Added permissions for logo resource.

## Checklist
-   [x] Tutorial appears on first run.
-   [x] Branding uses official logo.
-   [x] **Clean Extraction**: Daum News menus, copyright, and "related news" hidden.
-   [x] **Better Detection**: Donga.com articles load fully.
-   [x] **Pagination**: 2-Page view handles end-of-article gracefully (no duplication).
