/**
 * A vendored default-theme icon at the theme scale. `generate_icon` rasterises each icon through
 * `DPITexture::create_from_string(source, scale)` (`default_theme.cpp:82-84`), whose size is the SVG's
 * own times the scale, rounded (`image_loader_svg.cpp:92-93`).
 */

import type { Vector2 } from '../../../godot/math/vector';
import { svgDataUrl } from './themeIcons';

const SVG_DATA_PREFIX = svgDataUrl('');

/** The icon's pixel size at `scale`, from its authored size. */
export function scaledIconSize(authoredPx: number, scale: number): number {
  return Math.max(1, Math.round(authoredPx * scale));
}

/** A vendored icon's pixel size at `scale`, each axis rounded alone: 32x16 at 1.5 is 48x24. */
export function scaledIconSizeOf(authored: Vector2, scale: number): Vector2 {
  return { x: scaledIconSize(authored.x, scale), y: scaledIconSize(authored.y, scale) };
}

/** `tag` with the attribute `name` set to `value`, added after `<svg` when the tag has none. */
function withAttribute(tag: string, name: string, value: string): string {
  const attribute = ` ${name}="${value}"`;
  const match = new RegExp(`\\s${name}="[^"]*"`).exec(tag);
  if (!match) return `<svg${attribute}${tag.slice('<svg'.length)}`;
  return tag.slice(0, match.index) + attribute + tag.slice(match.index + match[0].length);
}

/**
 * The same SVG with its root `width` and `height` scaled. A `viewBox` of the authored size goes on
 * when the root has none, so the drawing scales with the canvas instead of clipping to it.
 */
export function scaledSvgDataUrl(dataUrl: string, scale: number): string {
  if (scale === 1 || !dataUrl.startsWith(SVG_DATA_PREFIX)) return dataUrl;
  const svg = atob(dataUrl.slice(SVG_DATA_PREFIX.length));
  const root = /<svg\b[^>]*>/.exec(svg);
  if (!root) throw new Error(`expected an <svg> root in the icon, got ${svg.slice(0, 40)}`);
  const tag = root[0];
  const width = Number(/\swidth="([\d.]+)"/.exec(tag)?.[1]);
  const height = Number(/\sheight="([\d.]+)"/.exec(tag)?.[1]);
  if (!(width > 0 && height > 0)) throw new Error(`expected a sized <svg> root, got ${tag}`);
  let scaled = withAttribute(tag, 'width', String(scaledIconSize(width, scale)));
  scaled = withAttribute(scaled, 'height', String(scaledIconSize(height, scale)));
  if (!/\sviewBox=/.test(tag)) scaled = withAttribute(scaled, 'viewBox', `0 0 ${width} ${height}`);
  const end = root.index + tag.length;
  return svgDataUrl(btoa(svg.slice(0, root.index) + scaled + svg.slice(end)));
}
