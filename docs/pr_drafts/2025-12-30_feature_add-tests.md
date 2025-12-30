# PR Draft: Comprehensive Unit Tests & Content Extraction Improvements

## PR Title
test: Add comprehensive unit tests and refine content extraction filters

## Summary
This PR introduces a robust unit test suite inspired by Kent Beck's "Tidy First" principles, achieving high coverage for the content script. It also restores and refines content extraction filters (tags, reporters, lazy loading) that were previously identified as necessary for cleaner reading.

## Technical Changes
- **Test Suite (`test/content.test.js`)**:
  - Rewritten from scratch to be modular and comprehensive.
  - **4 Major Describe Blocks**:
    1.  `Content Extraction`: Tests specific selectors, noise removal (tags, scripts), and attribute cleaning.
    2.  `UI & Navigation`: Tests toggle logic, keyboard shortcuts, and Smart Spacer presence.
    3.  `Settings & Storage`: Tests all user preference persistence (Theme, Fonts, Margins).
    4.  `Tutorial Flow`: Tests onboarding logic.
- **Content Script (`src/content.js`)**:
  - **Extraction Filters**: Added selectors for tags (`.tags`, `#article_tags`), reporter info (`.reporter_info`), and related news.
  - **Lazy Loading**: Logic now explicitly whitelists `data-src` and `data-original` during attribute stripping to ensure images load.

## Test Report
- **12/12 Tests Passing**
- Covered scenarios:
  - [x] Naver/Donga specific extraction.
  - [x] Tag/Metadata removal.
  - [x] Lazy image handling.
  - [x] Settings persistence (Theme, Font Size, Margins).
  - [x] Tutorial completion state.

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes.
