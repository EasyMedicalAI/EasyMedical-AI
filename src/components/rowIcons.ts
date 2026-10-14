// Point sizes for row icons, so each icon fills the same space on screen.
// The icon font draws some glyphs larger than others, so each icon is sized so its largest
// side is the same. Sizes were calculated from the glyph outlines.
const ROW_ICON_SIZES: Record<string, number> = {
  'gift-outline': 18.0,
  'account-outline': 25.0,
  'human-male-height': 20.0,
  'scale-bathroom': 20.0,
  'heart-pulse': 20.0,
  'water-outline': 24.0,
  'moon-waning-crescent': 20.0,
  'run': 18.5,
  'food-fork-drink': 20.0,
  'watch-variant': 16.5,
  'pill': 21.0,
  'alert-outline': 18.0,
  'stethoscope': 20.0,
  'book-open-page-variant-outline': 18.0,
  'calendar-outline': 20.0,
  'shield-check-outline': 18.0,
  'card-account-details-outline': 16.5,
  'storefront-outline': 20.0,
  'phone-alert-outline': 21.0,
};

export function rowIconSize(name: string): number {
  return ROW_ICON_SIZES[name] ?? 20;
}
