# PR Draft: Icon Enhancements

## PR Title
feat: Enhanced bottom menu with premium SVG icons, animations, and tooltips

## Summary
This PR modernizes the UI by replacing emoji icons with custom, premium SVG icons (Lucide-style). It also adds interactive elements like hover animations and tooltips to improve the user experience and accessibility.

## Technical Changes
- **SVG Icons:**
  - Replaced emojis (📖 📏 ↕️ ↔️ 📄) in the Settings Popup with inline SVG icons.
  - Replaced "Gear" and "Close" buttons with cleaner SVG paths.
  - Standardized icon size and stroke width.
- **Animations:**
  - Added scale transform on hover/active states for all interaction buttons.
  - Added rotation animation for the Settings gear icon on hover.
  - Added color shift (Red) for the Close button on hover.
- **Tooltips:**
  - Implemented a custom `showTooltip` helper in `src/content.js`.
  - Added `.releaf-tooltip` styles in `src/styles.css` for floating, fade-in labels.
  - Removed native `title` attributes in favor of custom `data-tooltip` behavior.
- **Styling:**
  - Added opacity (0.6) to settings icons for a refined, less distracting look.
  - Flexbox alignment fixes for icon + label pairing.

## Test Report
- [x] **Unit Tests:** Updated `test/content.test.js` to match new `data-tooltip` attribute logic. All tests passed.
- [x] **Manual Verification:**
  - Verified icon crispness on high-DPI screens.
  - Verified hover animations (scale, rotate).
  - Verified tooltip positioning and appearance.
  - Verified settings popup layout with new icons.

## Checklist
- [x] Code follows "Tidy First" principles.
- [x] Unit tests included and passing.
- [x] No breaking changes.
