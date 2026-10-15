/** A `ThemeResource` that declares nothing, with the fields a test cares about overridden. */
import type { ThemeResource } from '../../../../resources/styles/theme/types';

export function themeResource(overrides: Partial<ThemeResource> = {}): ThemeResource {
  return {
    defaultFont: null,
    defaultFontSize: undefined,
    fonts: {},
    fontSizes: {},
    typeVariations: {},
    properties: {},
    ...overrides,
  };
}
