# PR Draft: Improve Content Extraction for Generic Sites

## PR Title
fix: Enhance extraction robustness with generic page selectors

## Summary
Updates the content extraction logic to include a broader range of generic selectors (e.g., `.content`, `.report-content`, `[role="main"]`). This fixes issues on non-semantic websites (like InfluenceMap) where the extension previously failed to identify the main article body.

## Technical Changes
- **`src/content.js`**:
  - Expanded `candidates` array with:
    - `[role="main"]`
    - `.content`, `.page-content`
    - `.report-content`, `.document-body`
  - This increases the hit rate for the "main content" heuristic before falling back to `document.body`.

## Test Report
- **23/23 Tests Passing**
- Confirmed that new generic selectors are correctly prioritized in test cases.

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes.
