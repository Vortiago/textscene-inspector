/**
 * A vendored default-theme icon at the theme scale. `generate_icon` rasterises each icon through
 * `DPITexture::create_from_string(source, scale)` (`default_theme.cpp:82-84`), whose size is the SVG's
 * own times the scale, rounded (`image_loader_svg.cpp:92-93`).
 */

const SVG_DATA_PREFIX = 'data:image/svg+xml;base64,';

/** The icon's pixel size at `scale`, from its authored size. */
export function scaledIconSize(authoredPx: number, scale: number): number {
  return Math.max(1, Math.round(authoredPx * scale));
}

/**
 * The same SVG with its root `width` and `height` scaled. A `viewBox` of the authored size goes on
 * when the root has none, so the drawing scales with the canvas instead of clipping to it.
 */
export function scaledSvgDataUrl(dataUrl: string, scale: number): string {
  if (scale === 1 || !dataUrl.startsWith(SVG_DATA_PREFIX)) return dataUrl;
  const svg = atob(dataUrl.slice(SVG_DATA_PREFIX.length));
  const root = /<svg\b[^>]*>/.exec(svg)?.[0];
  if (!root) throw new Error(`expected an <svg> root in the icon, got ${svg.slice(0, 40)}`);
  const width = Number(/\swidth="([\d.]+)"/.exec(root)?.[1]);
  const height = Number(/\sheight="([\d.]+)"/.exec(root)?.[1]);
  if (!(width > 0 && height > 0)) throw new Error(`expected a sized <svg> root, got ${root}`);
  let scaled = root
    .replace(/\swidth="[\d.]+"/, ` width="${scaledIconSize(width, scale)}"`)
    .replace(/\sheight="[\d.]+"/, ` height="${scaledIconSize(height, scale)}"`);
  if (!/\sviewBox=/.test(root)) scaled = scaled.replace(/^<svg\b/, `<svg viewBox="0 0 ${width} ${height}"`);
  return SVG_DATA_PREFIX + btoa(svg.replace(root, scaled));
}
