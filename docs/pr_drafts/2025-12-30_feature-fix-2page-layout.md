# PR Title
fix: Resolve 2-page view empty column bug via Strict Columns & Virtual Overscroll

# Summary
This PR addresses the "empty column" and content duplication issues observed in the 2-page reader view, particularly on the last pages of content. It replaces the browser's native/fuzzy column handling with a precise JavaScript-driven calculation and implements a "Virtual Overscroll" mechanism to handle edge-case scrolling alignment.

# Technical Changes
-   **Strict Column Widths**: Updated `src/content.js` to calculate column widths exactly as `(viewport - margins - gap) / 2` and enforced this via the `--releaf-column-width` CSS variable. This eliminates sub-pixel rounding errors that caused ghost columns.
-   **Virtual Overscroll**: Implemented `setScrollPosition` and `getVirtualScroll` helpers. When a user navigates to the end of the document where the content doesn't perfectly fill the viewport (triggering browser clamping), we now apply a CSS `transform: translateX(...)` to visually shift the final page into alignment.
-   **Refactoring**: Updated all navigation inputs (Keyboard `ArrowLeft`/`ArrowRight`, Touch Zones, Resize) to use the new centralized scroll helpers.
-   **Revert**: Removed previous attempts at using `padding-right` or DOM spacers, as they introduced other layout side effects.

# Test Report
-   [x] **Unit Tests**: All 26 tests passed, including new test cases for:
    -   `Strict Column`: Verifying exact CSS variable definition.
    -   `Virtual Overscroll`: Verifying transform application on overflow navigation.
-   [x] **Manual Verification**: Verified on standard and edge-case articles (short/odd length) in 2-page view.

# Checklist
-   [x] Code follows "Tidy First" principles.
-   [x] Unit tests included and passing.
-   [x] No breaking changes.
