# PR: Content Extraction Fixes (NYT & BBC)

## Summary
This PR addresses critical content extraction failures on major news sites (New York Times and BBC News). It improves the robustness of the extraction algorithm to handle complex "Lead Images" that are structurally separated from the article body (NYT) and implements a new sub-system for handling JavaScript-heavy video players (BBC) by converting them into interactive placeholders.

## Technical Changes

### 1. Robust Lead Image Extraction (NYT Fix)
- **Problem**: NYT article bodies often contain minor inline images. The previous "fallback" logic for finding a lead image only triggered if *no* images were found in the body. This caused the main high-quality header image to be ignored.
- **Solution**: Refined `extractContent` in `src/content/utils.js`. It now explicitly checks for a `header figure` (common pattern for lead images) and injects it if it's missing from the extracted content, regardless of whether other minor images exist.

### 2. Video Support for BBC News
- **Problem**: BBC uses a custom Shadow DOM-based video player (`<smp-toucan-player>`) that relies on finding the poster image deep within the shadow tree. Reader Mode previously rendered this as a blank space.
- **Solution**:
    - **Shadow DOM Traversal**: Implemented `findPosterImage` and `prepareVideoBlocks` in `utils.js` to recursively search Light DOM and Open Shadow DOM for the hidden poster image.
    - **Interactive Placeholders**: Implemented `transformVideoBlocks` to convert these complex video containers into simple `<figure>` elements displaying the extracted poster.
    - **Click-to-Restore**: Added interactivity. Clicking the placeholder now triggers `toggleReleaf()` to exit Reader Mode and restore the original page, allowing the user to watch the video.
    - **Sanitization Updates**: Updated `sanitizeAndFixContent` to allow `data-action` attributes and preserve `releaf-` scoped classes.

### 3. Architecture Improvements
- **Pipeline Reordering**: Moved `transformVideoBlocks` to run *before* `cleanupNodes`. This prevents aggressive noise filters (which target generic divs) from accidentally deleting video containers before they can be transformed into safe figures.
- **Event Handling**: Updated `src/content/main.js` to properly handle click events on interactive placeholders, ensuring they don't conflict with the existing "tap-to-show-menu" logic.

## Test Report
- **Unit Tests**:
    - `test/content/utils.test.js` updated to verify NYT fallback logic with noise.
    - New test cases added for BBC video block transformation, attribute preservation, and interactive properties.
    - All tests passing (`npm test`).
- **Manual Verification**:
    - Verified on NYT (Lead image appears).
    - Verified on BBC (Video placeholder appears with correct image; clicking exits reader mode).

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes.
