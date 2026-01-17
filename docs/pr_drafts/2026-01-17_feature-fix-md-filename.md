# PR: Fix Markdown Filename Generation

## Summary
Improves the filename generation logic for the "Download as Markdown" feature. It now uses the page title (`document.title`) as the source, sanitizes it by removing illegal characters and replacing spaces with underscores, and truncates it to 60 characters to ensure filesystem compatibility.

## Technical Changes
-   **`src/content/main.js`**:
    -   Updated `triggerDownload` to use `document.title` instead of H1 or fallback.
    -   Implemented robust sanitization:
        -   Removes `<>:"/\|?*` and control characters.
        -   Replaces whitespace with underscores.
        -   Collapses multiple underscores.
        -   Trims leading/trailing underscores.
    -   Added truncation to 60 characters.
    -   Updated frontmatter generation to match.

## Test Report
-   **Unit Tests**:
    -   Updated `test/content/main.test.js` to mock `document.title`.
    -   Added test case: `Should sanitize filename: replace spaces, remove illegal chars`.
    -   Added test case: `Should truncate long filenames to 60 chars`.
    -   All tests passed.
-   **Manual Verification**:
    -   Verified that downloaded files carry the tab title, are clean of spaces/special chars, and are truncated.

## Checklist
-   [x] Code follows "Tidy First" principles.
-   [x] Unit tests included and passing.
-   [x] No breaking changes.
