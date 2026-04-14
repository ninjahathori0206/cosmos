# Digitisation Item Selection (Like Colour Tabs)

## Goal
Enable **Item selection** in Digitisation the same way colours are selected now:
- User selects one Item
- Only that Item section is visible
- Existing colour-tab behavior inside the selected Item remains unchanged

## Current Behavior
- Colour selection exists via tabs inside each item panel.
- All item sections are rendered in sequence, so users scroll to switch items.

## Proposed UI
- Add a top-level **Item selector bar** above item panels:
  - Desktop: horizontal tabs (`Item A`, `Item B`, `Item C`, ...)
  - Mobile fallback: compact dropdown (optional)
- Keep current colour tabs exactly as-is inside each item.

## Interaction Flow
1. Page loads Digitisation data.
2. Build Item selector from fetched `items`.
3. Set first item as active by default.
4. On item click:
   - hide other item sections
   - show selected item section
   - keep its internal colour tab logic unchanged

## Data/Logic Impact
- No backend API changes.
- No payload shape changes.
- No change to SKU generation/media upload/product spec save behavior.
- This is a front-end visibility/state enhancement only.

## Implementation Notes
- Add item selector container in Digitisation render block.
- Add active item state variable (e.g., `activeItemId`).
- Add helper to switch item visibility (similar to existing `switchDigiTab` pattern).
- Preserve existing IDs and handlers to avoid regressions.

## Acceptance Criteria
- Item selector is visible when 2+ items exist.
- Only one item section is shown at a time.
- Colour tabs still work within selected item.
- Generate SKU, media save, and product spec save continue to work without changes.
- Publish button logic remains identical.
