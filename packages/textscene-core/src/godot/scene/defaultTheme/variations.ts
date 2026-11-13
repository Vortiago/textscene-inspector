/**
 * The type variations the default theme registers, each with its base type (`Theme::set_type_variation`,
 * `scene/theme/default_theme.cpp:357-358`, `:394-401`, `:814`, `:845`, `:1167`, `:1171`). The bases do not
 * depend on the theme scale.
 */
export const DEFAULT_THEME_VARIATION_BASES: Readonly<Record<string, string>> = {
  FlatButton: 'Button',
  FlatMenuButton: 'MenuButton',
  GraphFrameTitleLabel: 'Label',
  GraphNodeTitleLabel: 'Label',
  HeaderLarge: 'Label',
  HeaderMedium: 'Label',
  HeaderSmall: 'Label',
  TooltipLabel: 'Label',
  TooltipPanel: 'PopupPanel',
};

/** The base the default theme registers for `variation`. Own keys only: a variation named `constructor` reads no prototype. */
export function defaultThemeVariationBase(variation: string): string | undefined {
  return Object.hasOwn(DEFAULT_THEME_VARIATION_BASES, variation)
    ? DEFAULT_THEME_VARIATION_BASES[variation]
    : undefined;
}
