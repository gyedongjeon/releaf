# Fix: Previous Navigation Off-By-One Error

## Summary
Fixes a bug where navigating to the previous page would skip a page (jumping back 2 pages instead of 1) if the view was perfectly aligned with a page boundary. This was caused by `Math.floor` behavior in the page index calculation.

## Technical Changes
- **Refactor `navigatePage`**: Updated `src/content/main.js` to use `Math.round(currentVirtual / effWidth)` for determining the current page index. This ensures that floating point precision or perfect alignment doesn't cause the index to be floored to the *previous* page before the offset is even applied.
- **Regression Test**: Added a specific test case in `test/content/main.test.js` ("Bug Repro: Should navigate to previous page correctly") that simulates exact page alignment and verifies correct target scroll position.

## Test Report
- **Unit Tests**: All 39 tests passed, including the new regression test.
- **Manual Verification**: Verified via regression test case.

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes.
