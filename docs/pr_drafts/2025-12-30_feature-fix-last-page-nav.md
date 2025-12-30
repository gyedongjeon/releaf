# PR Title
fix: Prevent navigation past the last page

# Summary
This PR addresses a bug where users could navigate beyond the last page of content, resulting in the view scrolling into empty space. It introduces boundary checks to the navigation logic to ensure the current page index never exceeds the total page count.

# Technical Changes
-   **Helper**: Added `getTotalPages()` to centralize page count calculation logic.
-   **Logic Update**: Updated `goToNextPage` and `handleKeyNavigation` to check if `targetPage >= getTotalPages()` before executing the scroll.
-   **Test**: Added a new unit test "Navigation Limit: Should not navigate past the last page" to verify the boundary check.

# Test Report
-   [x] **Unit Tests**: All 27 tests passed, including the new boundary test.
-   [x] **Manual Verification**: Verified that clicking "Next" or pressing Right Arrow on the last page does not advance the view.

# Checklist
-   [x] Code follows "Tidy First" principles.
-   [x] Unit tests included and passing.
-   [x] No breaking changes.
