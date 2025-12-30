# PR Draft: Improve Content Extraction with Text Density Heuristic

## PR Title
fix: Implement Text Density Heuristic for robust content extraction

## Summary
This PR significantly improves Re:Leaf's ability to identify article content on non-standard websites. It introduces a **Text Density Heuristic** fallback: if standard selectors fail, Re:Leaf scans the DOM for the block element with the highest text-to-link ratio. This solves issues on sites like InfluenceMap where content is in generic containers.

## Technical Changes
- **`src/content.js`**:
  - Added Generic Selectors (`.content`, `.report-content`, etc.) to candidates.
  - **New Algorithm**: Implemented a "Density Scan" fallback.
    - Scans `div, section, article, main`.
    - Scores blocks based on text length.
    - Penalizes blocks with high link density (navigation/footers).
    - Selects the highest scoring block > 200 chars.
- **`test/content.test.js`**:
  - Added test case for "Text Density Fallback" using a DOM structure with no class names but clear main content vs. navigation.

## Test Report
- **24/24 Tests Passing**
- [x] Generic Selector Extraction
- [x] Text Density Fallback (verified identifying main text vs sidebar)

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes.
