# PR Draft: Feature - Download as Markdown

## Summary
Introduces a new feature allowing users to download the Reader View content as a clean Markdown (`.md`) file. This includes content sanitization, metadata frontmatter, and a dedicated download button in the UI.

## Technical Changes
- **`src/content/utils.js`**:
    - Implemented `domToMarkdown` for lightweight HTML-to-Markdown conversion (supports headers, lists, links, images, tables, code blocks).
    - Added `addFrontmatter` to prepend YAML metadata (title, url, date).
    - Enhanced `cleanupNodes` with Wikipedia-specific selectors (`.mw-indicators`, `#siteSub`, etc.).
    - Updated `createIconSvg` with a new "Markdown Download" icon (Standard Mark + Arrow).
- **`src/content/main.js`**:
    - Added `triggerDownload` function to orchestrate conversion, filename sanitization, and download triggering.
    - Filename format: `YYYY-MM-DD_Article_Title.md`.
- **`src/content/ui.js`**:
    - Added "Download" button to the bottom menu.
    - Added native tooltip `title="Download Markdown (.md)"`.

## Test Report
- **Unit Tests**:
    - Verified `domToMarkdown` conversion for all supported elements.
    - Verified `addFrontmatter` YAML generation.
    - Verified filename sanitization and Wikipedia noise removal.
- **Manual Verification**:
    - Tested on generic articles, Wikipedia, and Daum News.
    - Confirmed date prefix and frontmatter in downloaded files.

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes.
