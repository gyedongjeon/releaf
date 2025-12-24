# PR: Robust Content Extraction & Black Box Fixes

## Summary
Significantly refactored the content extraction logic to be more robust across various news sites (Naver News, BBC, The Verge, Wikipedia). Switched from a strict allowlist approach to a "Tree Cleaning" strategy that preserves document structure while stripping unwanted elements. Fixed a reported visual bug ("Black Box") on BBC articles caused by unhandled video containers.

## Technical Changes
-   **Refactored `extractContent()`**:
    -   Replaced "Flattening Allowlist" with a `TreeWalker` approach to preserve semantic structure and text nodes.
    -   Added logic to strip attributes while keeping `src`, `href`, `alt`, etc.
    -   Added support for Naver News specific selectors (`#dic_area`, `.newsct_article`).
-   **Media Handling**:
    -   Added specialized handling for lazy-loaded images (`data-src`, `data-original`).
    -   **BBC Fix**: Explicitly added `video`, `audio`, `canvas`, `object`, `embed`, and `[data-component="video-block"]` to the `unwantedSelectors` list to remove non-functional media players that appeared as black boxes.
-   **Clean Up**:
    -   Restored filtering for language lists and sidebars to fix test regressions.

## Test Report
-   **Automated Tests**: All unit tests in `test/content.test.js` passed.
-   **Manual Verification**:
    -   **Wikipedia**: Verified clean extraction of "Artificial Intelligence" article.
    -   **The Verge**: Verified extraction of tech news articles.
    -   **Naver News**: Verified text is now correctly extracted (previously missing).
    -   **BBC**: Verified removal of the large black video player placeholder.

## Checklist
-   [x] Code follows "Tidy First" principles.
-   [x] Unit tests included and passing.
-   [x] No breaking changes.
