/**
 * Rasterise a live Control-overlay DOM subtree into a 2D canvas, so WebGL can
 * sample it (ADR-0003 amendment). Godot Controls render as DOM (never textured
 * quads), but a `SubViewport` full of Controls composited onto a 3D surface via
 * `ViewportTexture` needs a *derived raster* of that DOM.
 *
 * Technique: clone the subtree → inline every computed style onto the clone →
 * wrap in `<svg><foreignObject>` → data URL → `Image` → `drawImage`. The browser
 * does the layout, text shaping, `object-fit`, clipping, opacity, filters and
 * stacking; we only hand it a self-contained document.
 *
 * "Self-contained" is the whole trick. Chrome renders SVG-as-image in a
 * restricted mode that **blocks every sub-resource load except `data:`** — a
 * `blob:` or `http:` `<img>`/`background-image` rasterises as nothing, silently.
 * `inlineExternalImages` therefore rewrites any non-`data:` image source in the
 * clone to a `data:` URL first (drawing the already-decoded bitmap to a canvas,
 * the same trick as `imageToDataUrl`). Control images already arrive as `data:`
 * URLs per ADR-0003, so that pass is usually a no-op — it is what keeps the
 * rasteriser correct for anything that is not.
 *
 * The element must be **laid out**: attached to the document with a non-zero
 * border box. Since every computed property is inlined and only position,
 * margin and size are overridden, any *presentational* property on the element
 * passed in is carried into the raster. So a host rendering off-screen must
 * hide itself by MOVING off-screen (or behind an ancestor's `overflow: hidden`
 * — ancestors are not cloned), never with `display`, `visibility`, `opacity` or
 * `clip-path` on the element itself. Measured in `verify-raster.mjs`: at
 * `left: -99999px` a fixture rasterises 5366 opaque px; `visibility: hidden`,
 * `opacity: 0` and `clip-path: inset(100%)` each rasterise 0 — and the first
 * three return a BLANK canvas rather than `null`, so the "not ready" signal
 * below cannot warn about them.
 *
 * Every failure — no element, not laid out, zero size, no canvas support, the
 * SVG image refusing to load — returns `null`. Callers read `null` as
 * "not ready", never as an error.
 */

/** Options for {@link rasterizeControlSubtree}. */
export interface RasterizeControlSubtreeOptions {
  /**
   * Output width in CSS px. Defaults to the element's measured border box.
   * A value differing from the measured width **scales** the raster (the SVG
   * viewBox is the source rect), and scales each axis independently — so a
   * caller wanting no distortion should size the DOM host to the target
   * (for a SubViewport: its `size`) and leave these unset.
   */
  width?: number;
  /** Output height in CSS px. See {@link RasterizeControlSubtreeOptions.width}. */
  height?: number;
  /**
   * Supersampling factor applied on top of `width`/`height`: the canvas gets
   * `width * pixelRatio` backing pixels. Default 1. Values <= 0 are ignored.
   */
  pixelRatio?: number;
  /**
   * Painted underneath the subtree (any CSS colour). Default: nothing, leaving
   * the canvas transparent — which is what a Godot SubViewport with
   * `transparent_bg` produces.
   */
  backgroundColor?: string;
  /**
   * Draw into this canvas instead of allocating one. Reusing a canvas lets a
   * caller keep one `THREE.CanvasTexture` alive across redraws and just flip
   * `needsUpdate`, instead of re-uploading a new texture object each frame.
   */
  canvas?: HTMLCanvasElement;
}

/** XHTML namespace — foreignObject content must declare it or the SVG won't parse. */
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * Rasterise `element` and its descendants as they are currently laid out.
 *
 * @returns the canvas that was drawn into (the one from `options.canvas` when
 * supplied), or `null` when the subtree is not rasterisable yet.
 */
export async function rasterizeControlSubtree(
  element: Element | null | undefined,
  options: RasterizeControlSubtreeOptions = {}
): Promise<HTMLCanvasElement | null> {
  // Measure and bail BEFORE any clone/serialize/Image work: a DOM without
  // layout (happy-dom) reports a zero rect, and must never reach the `Image`
  // load below, which would never settle there.
  const source = measureSubtree(element);
  if (!source) return null;

  const width = positiveOr(options.width, source.width);
  const height = positiveOr(options.height, source.height);
  const ratio = positiveOr(options.pixelRatio, 1);

  try {
    const svgUrl = await buildSubtreeSvgUrl(element as Element, source);
    if (!svgUrl) return null;

    const image = await loadImage(svgUrl);
    if (!image) return null;

    const canvas = options.canvas ?? element!.ownerDocument.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (options.backgroundColor) {
      ctx.fillStyle = options.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch {
    return null; // serialization, tainting, or an unsupported image source
  }
}

/** The laid-out size of a subtree, or null when it has none. */
interface SubtreeRect {
  width: number;
  height: number;
}

/**
 * The element's border box in CSS px, or `null` when there is nothing to draw:
 * no element, detached from a document, or zero-sized (not laid out yet,
 * `display: none`, or genuinely empty).
 *
 * `offsetWidth`/`offsetHeight` are read first because they are the UNTRANSFORMED
 * border box, which is what the raster should cover — `getBoundingClientRect`
 * would report a rotated element's larger axis-aligned bounds. The rect is the
 * fallback, for the elements that have no offset box at all (SVG children, and
 * anything under `display: contents`).
 */
function measureSubtree(element: Element | null | undefined): SubtreeRect | null {
  if (!element || !element.ownerDocument?.defaultView) return null;
  if (typeof element.getBoundingClientRect !== 'function') return null;

  const layout = element as Partial<HTMLElement>;
  let width = Math.round(layout.offsetWidth ?? 0);
  let height = Math.round(layout.offsetHeight ?? 0);
  if (width <= 0 || height <= 0) {
    const rect = element.getBoundingClientRect();
    width = Math.round(rect?.width ?? 0);
    height = Math.round(rect?.height ?? 0);
  }
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/** `value` when it is a finite positive number, else `fallback`. */
function positiveOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Clone the subtree, inline its computed styles, inline its image sources, and
 * serialise the result as an `image/svg+xml` data URL. Returns null when the
 * document has no `XMLSerializer` (non-browser hosts).
 */
async function buildSubtreeSvgUrl(element: Element, rect: SubtreeRect): Promise<string | null> {
  const view = element.ownerDocument.defaultView;
  if (!view || typeof view.XMLSerializer !== 'function') return null;

  const clone = element.cloneNode(true) as Element;
  inlineComputedStyles(view, element, clone);
  detachRootPositioning(clone, rect);
  await inlineExternalImages(element, clone);

  // foreignObject content is XML, so the XHTML namespace must be declared on
  // the wrapper or the SVG parses as unknown elements and paints nothing.
  const holder = element.ownerDocument.createElementNS(XHTML_NS, 'div');
  holder.setAttribute('xmlns', XHTML_NS);
  holder.appendChild(clone);
  const markup = new view.XMLSerializer().serializeToString(holder);
  return buildSvgDataUrl(markup, rect.width, rect.height);
}

/**
 * Copy every computed property from each source element onto its clone as an
 * inline `style` attribute.
 *
 * The clone leaves the document, so nothing in the cascade reaches it —
 * stylesheets, `@media`, inherited values. Computed style is the flattened
 * answer to all of them, and it is *used* values (resolved px, resolved
 * colours), which is exactly what a static raster wants. Control subtrees are
 * pure inline styles today (ADR-0003), so this mostly round-trips; it is what
 * makes the rasteriser independent of that staying true.
 */
function inlineComputedStyles(view: Window, source: Element, clone: Element): void {
  const sources: Element[] = [source, ...source.querySelectorAll('*')];
  const clones: Element[] = [clone, ...clone.querySelectorAll('*')];
  // A mismatch means the DOM changed under us mid-clone; drawing a half-styled
  // tree would be worse than drawing an unstyled one, so just stop.
  if (sources.length !== clones.length) return;

  for (let i = 0; i < sources.length; i++) {
    const from = sources[i];
    const to = clones[i];
    if (!from || !to) continue;
    const computed = view.getComputedStyle(from);
    let text = '';
    for (let p = 0; p < computed.length; p++) {
      const name = computed.item(p);
      text += `${name}:${computed.getPropertyValue(name)};`;
    }
    to.setAttribute('style', text);
  }
}

/**
 * Re-root the clone at the raster's origin. The source element is typically
 * absolutely positioned inside the app shell, and inlining its computed style
 * carries those offsets over — which would push the content off the raster.
 * `position: relative` is kept (not `static`) so absolutely-positioned
 * descendants still resolve against the root, as they did live.
 */
function detachRootPositioning(clone: Element, rect: SubtreeRect): void {
  const style = (clone as Partial<HTMLElement>).style;
  if (!style) return;
  style.position = 'relative';
  style.left = '0';
  style.top = '0';
  style.right = 'auto';
  style.bottom = 'auto';
  style.margin = '0';
  style.width = `${rect.width}px`;
  style.height = `${rect.height}px`;
}

/**
 * Rewrite every non-`data:` image source in the clone to a `data:` URL.
 *
 * Chrome renders SVG-as-image with sub-resource loading disabled, so a `blob:`
 * or `http:` `<img src>` / `background-image` inside the foreignObject draws
 * *nothing* — no error, no `onerror`, just a hole. Converting to `data:` is the
 * fix, and it lets the browser keep doing `object-fit`, `background-size`,
 * tiling and transforms, which a draw-the-bitmaps-on-top composite pass could
 * not.
 *
 * Sources that cannot be converted (cross-origin taint, still decoding) are
 * left alone: they were already going to draw nothing.
 */
async function inlineExternalImages(source: Element, clone: Element): Promise<void> {
  const cache = new Map<string, string | null>();
  const toDataUrl = async (url: string, live: HTMLImageElement | null): Promise<string | null> => {
    const cached = cache.get(url);
    if (cached !== undefined) return cached;
    const encoded = await encodeImageAsDataUrl(source.ownerDocument, url, live);
    cache.set(url, encoded);
    return encoded;
  };

  const liveImages = [...source.querySelectorAll('img')];
  const clonedImages = [...clone.querySelectorAll('img')];
  const aligned = liveImages.length === clonedImages.length;
  for (let i = 0; i < clonedImages.length; i++) {
    const cloned = clonedImages[i];
    const src = cloned?.getAttribute('src');
    if (!cloned || !src || isDataUrl(src)) continue;
    const encoded = await toDataUrl(src, (aligned && liveImages[i]) || null);
    if (encoded) cloned.setAttribute('src', encoded);
  }

  // `background-image` is already inlined as a computed value by this point, so
  // the clone is the only thing to walk.
  for (const element of [clone, ...clone.querySelectorAll('*')]) {
    const style = (element as Partial<HTMLElement>).style;
    const value = style?.backgroundImage;
    if (!value || value === 'none') continue;
    const urls = extractCssUrls(value).filter((url) => !isDataUrl(url));
    if (urls.length === 0) continue;
    const replacements = new Map<string, string>();
    for (const url of urls) {
      const encoded = await toDataUrl(url, null);
      if (encoded) replacements.set(url, encoded);
    }
    if (replacements.size > 0) style.backgroundImage = replaceCssUrls(value, replacements);
  }
}

/**
 * Decode `url` in the *host* document — where `blob:` and same-origin `http:`
 * still load — and re-emit it as a `data:` URL. `live` short-circuits the load
 * when the page already holds the decoded bitmap.
 *
 * Returns null when the image cannot be decoded or the draw taints the canvas
 * (a cross-origin source without CORS headers).
 */
async function encodeImageAsDataUrl(
  doc: Document,
  url: string,
  live: HTMLImageElement | null
): Promise<string | null> {
  const decoded = live?.complete && live.naturalWidth > 0 ? live : await loadImage(url, doc);
  if (!decoded) return null;
  const width = decoded.naturalWidth || decoded.width;
  const height = decoded.naturalHeight || decoded.height;
  if (!width || !height) return null;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(decoded, 0, 0);
    return canvas.toDataURL();
  } catch {
    return null; // tainted canvas
  }
}

/**
 * Load `url` into an `Image`, resolving null on failure rather than rejecting.
 * `decode()` is awaited where available so the bitmap is ready for `drawImage`.
 */
function loadImage(url: string, doc?: Document): Promise<HTMLImageElement | null> {
  const view = doc?.defaultView ?? globalThis;
  const ImageCtor = (view as { Image?: typeof Image }).Image;
  if (typeof ImageCtor !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new ImageCtor();
    image.onload = () => {
      const settle = () => resolve(image);
      // decode() rejects on some hosts for SVG sources even after a good load;
      // the bitmap is usable either way, so failure still resolves the image.
      if (typeof image.decode === 'function') image.decode().then(settle, settle);
      else settle();
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * Wrap serialized XHTML markup in an SVG `foreignObject` and encode it as a
 * data URL. Explicit `width`/`height` attributes matter: without them some
 * hosts draw the SVG image at zero size.
 *
 * Exported for unit testing — it is the pure core of the serialization step.
 */
export function buildSvgDataUrl(markup: string, width: number, height: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<foreignObject width="100%" height="100%">${markup}</foreignObject>` +
    `</svg>`;
  // encodeURIComponent, not btoa: the markup is arbitrary Unicode (Control text)
  // and btoa throws on anything outside Latin-1.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Whether `url` is already self-contained, and so safe inside SVG-as-image. */
export function isDataUrl(url: string): boolean {
  return /^data:/i.test(url.trim());
}

/**
 * Every `url(...)` target in a CSS image value, unquoted and in order.
 * A value can carry several (`background-image` accepts a comma list, and
 * gradients sit alongside urls without contributing any).
 *
 * Exported for unit testing.
 */
export function extractCssUrls(value: string): string[] {
  const urls: string[] = [];
  const pattern = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)\s]*))\s*\)/g;
  for (const match of value.matchAll(pattern)) {
    const url = match[1] ?? match[2] ?? match[3] ?? '';
    if (url) urls.push(url);
  }
  return urls;
}

/**
 * Rewrite `url(...)` targets in a CSS image value using `replacements`, leaving
 * untouched anything absent from the map (gradients, already-`data:` urls).
 * Replacements are emitted double-quoted, which is safe for the `data:` URLs
 * this produces (base64 and percent-encoding contain no quote).
 *
 * Exported for unit testing.
 */
export function replaceCssUrls(value: string, replacements: ReadonlyMap<string, string>): string {
  const pattern = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)\s]*))\s*\)/g;
  return value.replace(pattern, (whole, dq?: string, sq?: string, bare?: string) => {
    const url = dq ?? sq ?? bare ?? '';
    const next = replacements.get(url);
    return next ? `url("${next}")` : whole;
  });
}
