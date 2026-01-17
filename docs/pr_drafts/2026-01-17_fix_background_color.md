# PR Draft: Fix Theme Color Contrast Issues

## Summary
Fixes text visibility issues across different themes, specifically:
- **Dark Mode**: Headers were invisible (black text on black background).
- **Forest/Gray Themes**: Links were invisible (default blue on green/gray background).

## Technical Changes

### `src/styles.css`
- Added default `--releaf-link-rgb` variable to `:root`.
- Explicitly set header colors to use `--releaf-heading-rgb` with fallback.
- Added `.releaf-content a` styling for theme-aware link colors.
- Added theme-specific CSS classes for Mint, Forest, and Gray (reference).

### `src/content/main.js`
- Extended `themeColors` object with `link` property for each theme.
- Applied `--releaf-link-rgb` when theme changes.
- Persisted and loaded `releaf_link` from storage.

## Test Report
- **Dark Mode**: Headers now display in pure white.
- **Forest Theme**: Links now display in bright yellow for high contrast.
- **Gray Theme**: Links now display in bright yellow.
- **Other Themes**: Links use appropriate contrasting colors.

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] No breaking changes.
- [ ] Unit tests (visual verification only for CSS changes).
