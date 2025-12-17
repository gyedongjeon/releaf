# PR Draft: feature/mv3-scaffolding

**PR Title**: feat: Scaffold MV3 Chrome Extension structure

**Summary**:
This PR scaffolds the initial project structure for "Re:Leaf", a Chrome Extension designed to transform webpages into a clean, ebook-like formatting. It sets up the base for a Manifest V3 extension with core components including a background service worker, content scripts, and a basic test environment.

**Technical Changes**:
- **Manifest V3**: Created `manifest.json` with permissions for `activeTab` and `scripting`.
- **Background Script**: Added `src/background.js` to handle extension icon clicks and messaging.
- **Content Script**: Implemented `src/content.js` to toggle the reading view overlay.
- **Styles**: Added `src/styles.css` for the reader view UI.
- **Testing**: Installed `jest` and `jest-environment-jsdom`, and added `test/content.test.js` for unit testing the content script.
- **Git**: Added `.gitignore` configured for Node.js and macOS.

**Test Report**:
- **Status**: PASSED
- `test/content.test.js`: Verified `enableReleaf` and `toggleReleaf` functionality.
- Manual verification was performed by loading the unpacked extension in Chrome and testing the toggle mechanism.

**Checklist**:
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes (unless specified).
