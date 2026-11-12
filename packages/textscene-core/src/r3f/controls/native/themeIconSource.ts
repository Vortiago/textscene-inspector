/**
 * Picks the pixels of a vendored default-theme icon. At theme scale 1 that is Godot's own ThorVG
 * raster, which no browser raster matches on the rim. At another scale it is the scaled SVG, which
 * the browser rasterises: an exact match there would need ThorVG in the bundle.
 */

import { THEME_ICON_RASTERS } from './themeIconRasters.generated';
import { scaledSvgDataUrl } from './scaledSvgIcon';
import { vendoredIconKey } from './themeIcons';

/** The pixels of the vendored icon `svgUrl` at `scale`. Any other URL, such as a project's own texture, comes back as it is. */
export function themeIconSource(svgUrl: string, scale: number): string {
  const raster = scale === 1 ? THEME_ICON_RASTERS[vendoredIconKey(svgUrl) ?? ''] : undefined;
  return raster ?? scaledSvgDataUrl(svgUrl, scale);
}
