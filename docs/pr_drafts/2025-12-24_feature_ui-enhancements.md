# PR Draft: Enhanced UI/UX for Ebook Reader

## PR Title
feat: Enhanced UI with settings popup, 2-page view, and page counter

## Summary
This PR introduces significant UI/UX improvements to the Re:Leaf extension. It replaces the basic bottom menu with a glassmorphic design, adds a comprehensive settings popup for customization (themes, font size, margins), implements a 2-page view mode for a book-like experience, and adds a dynamic page counter.

## Technical Changes
- **Settings Popup:**
  - Implemented a cleaner, glassmorphic popup UI.
  - Added color swatches for instant theme switching.
  - Added sliders for `font-size`, `line-height`, `vertical-margin`, and `horizontal-margin`.
  - Added "Click outside to close" functionality.
- **Page View Modes:**
  - Added support for **2-Page View** using CSS Multi-column layout (`column-count: 2`).
  - Implemented precise scroll alignment logic (`Math.round` + margin subtraction) to ensure navigation snaps correctly to page boundaries.
  - Added `overflow-wrap: anywhere` to prevent layout breakage from long URLs.
  - Improved image constraints (`max-height: 60vh`, `column-span: none`) for multi-column layouts.
- **Page Counter:**
  - Added a dynamic "Current / Total" page counter to the bottom menu.
  - Updates in real-time on scroll and resize.
- **Visuals:**
  - Standardized specific UI elements (dark toggles, white backgrounds) for better contrast.
- **Refactoring:**
  - Cleaned up `src/content.js` event listeners.
  - Optimized CSS for better responsiveness.

## Test Report
- [x] **Unit Tests:** All tests in `test/content.test.js` passed.
- [x] **Manual Verification:**
  - Verified 1-page and 2-page scrolling behavior.
  - Verified theme switching updates background/text properly.
  - Verified settings popup opens/closes correctly.
  - Verified page counter updates correctly.
  - Verified layout on last page does not break.

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes.
