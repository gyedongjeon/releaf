# PR Title: Refactor: Modularize content.js and Add CI

## Summary
This PR refactors the core content script, splitting the monolithic `content.js` into smaller, single-responsibility modules (`utils`, `ui`, `main`) to improve testability and maintainability. It also introduces a GitHub Actions workflow to run unit tests automatically on Pull Requests.

## Technical Changes
- **Modularization**:
    - Split `src/content.js` into:
        - `src/content/utils.js`: Core logic and content extraction helpers.
        - `src/content/ui.js`: DOM generation for the Reader View.
        - `src/content/main.js`: Main orchestration and event handling.
- **Test Restructuring**:
    - Split `test/content.test.js` into `test/content/utils.test.js`, `ui.test.js`, and `main.test.js`.
- **Background Script**:
    - Updated `src/background.js` to inject the new split files sequentially (`data-order` dependency).
- **CI/CD**:
    - Added `.github/workflows/ci.yml` triggers `npm test` on PRs to `main` and `develop`.

## Test Report
- **Unit Tests**: All 33 existing tests pass.
- **Manual Verification**: verified content extraction, UI toggling, settings persistence, and tutorial flow on live pages.

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes.
