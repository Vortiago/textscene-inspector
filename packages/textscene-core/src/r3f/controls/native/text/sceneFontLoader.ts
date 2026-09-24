/**
 * Turns a resolved `FontResource` into `FontMetrics`, or into the bundled default when that fails,
 * and registers the bundled font through the same door, so registration and the settled channel
 * exist once. It is the one DOM-touching module of the font pipeline, and it never throws.
 */
import type { FontMetrics } from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { createOpenSansCanvasFontMetrics } from './openSansCanvasFontMetrics';
import { OPEN_SANS_WOFF2_BASE64 } from './openSansFontBytes';
import { parseSfntScalars, type SfntScalars } from './sfntTables';
import { createRuntimeFontMetrics, type CanvasFontMetrics, type DesignUnitWidthFn } from './runtimeFontMetrics';
import { resolveFontFileBytes } from './sceneFontResolution';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';

// happy-dom has neither `FontFace` nor a 2D canvas context, so under vitest the loader skips to the
// bundled default before any DOM font API. The skip is deliberate, so it does not warn.
// `r3f/internalTextLabel.tsx` uses the same detection.
const IS_VITEST = (() => {
  const proc = (globalThis as { process?: { env?: { VITEST?: string } } }).process;
  return proc?.env?.VITEST === 'true';
})();

/**
 * Design units per em for a font `sfntTables.ts` cannot parse; every measurement uses this size.
 * Large on purpose: Chromium pixel-snaps small canvas metrics. At 1000 px the box metrics of a corpus
 * `.woff2` matched its `hhea` ascent and descent exactly, and at 16 px the ascent was 12.5 units off.
 */
const SYNTHETIC_UNITS_PER_EM = 1000;

/** A counter suffix per load, so two scene fonts never collide in `document.fonts`. */
let familyCounter = 0;

/** A no-argument re-render trigger. */
export type SceneFontMetricsListener = () => void;

const settledListeners = new Set<SceneFontMetricsListener>();

/**
 * Subscribes to a font metrics load settling, and returns an unsubscribe function. `useBuildSolveTree.ts`
 * calls the same generation `bump` from it as for a resource arrival. It fires once per resource on
 * its first settle and once for the bundled font, never for a font that short-circuits synchronously.
 */
export function onSceneFontMetricsSettled(listener: SceneFontMetricsListener): () => void {
  settledListeners.add(listener);
  return () => {
    settledListeners.delete(listener);
  };
}

function notifySceneFontMetricsSettled(): void {
  for (const listener of settledListeners) listener();
}

type CacheEntry = { status: 'pending'; promise: Promise<FontMetrics> } | { status: 'settled'; metrics: FontMetrics };

/** Keyed by the resolved leaf `FontFileResource`, so nodes that share a font share one load. A `WeakMap` frees the entry of an evicted resource. */
const metricsCache = new WeakMap<FontFileResource, CacheEntry>();

/** Warns once per unresolvable resource, not per call: the peek runs on every solve pass, and the failure belongs to the resource. */
const warnedUnresolvable = new WeakSet<FontResource>();

function warnUnresolvable(font: FontResource, nodePath: string): void {
  if (warnedUnresolvable.has(font)) return;
  warnedUnresolvable.add(font);
  const reason =
    font.kind === 'system'
      ? `a SystemFont (OS family names: ${font.fontNames.join(', ') || '(none)'}) -- this previewer has no access to the user's system fonts`
      : 'no FontFile in its fallback chain carries loadable bytes';
  logger.warn(`[SceneFont] Node "${nodePath}": font resource is unresolvable (${reason}). Falling back to the bundled default font.`);
}

/**
 * The CSP-validated door (`default-src 'none'`, no `connect-src`, `font-src` or `worker-src`):
 * bytes in hand go to `new FontFace` and `document.fonts.add`, with no fetch of any URL, no worker,
 * eval or WASM. Resolves to `undefined` with no `FontFace`, and rejects only on bytes that are not
 * a font, so `bytes` is a thunk that does not decode where there is no door.
 */
async function registerFontFace(family: string, bytes: () => ArrayBuffer): Promise<Document | undefined> {
  // Read lazily: a non-DOM environment answers `undefined`, and a late `document.fonts` is still seen.
  const { FontFace: FontFaceCtor, document: doc } = globalThis as { FontFace?: typeof FontFace; document?: Document };
  if (!FontFaceCtor || !doc?.fonts) return undefined;
  const face = new FontFaceCtor(family, bytes());
  await face.load();
  doc.fonts.add(face);
  return doc;
}

/**
 * Registers `bytes` as a fresh `FontFace` and builds its `CanvasFontMetrics`. Ascent and descent
 * come from `head` and `hhea` for a plain SFNT, else from canvas box metrics. Throws on an invalid
 * font, and `resolveSceneFontMetrics` catches and falls back.
 */
async function loadRuntimeFont(bytes: ArrayBuffer, nodePath: string): Promise<CanvasFontMetrics> {
  const family = `tscn-scene-font-${++familyCounter}`;
  const doc = await registerFontFace(family, () => bytes);
  if (!doc) {
    logger.warn(`[SceneFont] Node "${nodePath}": no FontFace/document.fonts in this environment; falling back to the bundled default font.`);
    throw new Error('FontFace unavailable');
  }

  const tableScalars = parseSfntScalars(bytes);

  const measureCanvas = doc.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) {
    // Unreachable in a supported browser, but a real fallback that warns, unlike the `IS_VITEST`
    // skip, which never reaches this function.
    logger.warn(`[SceneFont] Node "${nodePath}": no 2D canvas context available; falling back to the bundled default font.`);
    throw new Error('CanvasRenderingContext2D unavailable');
  }

  const measurementUnitsPerEm = tableScalars?.unitsPerEm ?? SYNTHETIC_UNITS_PER_EM;
  ctx.font = `${measurementUnitsPerEm}px "${family}"`;
  const measureWidthUnits: DesignUnitWidthFn = (text) => ctx.measureText(text).width;

  let scalars: SfntScalars;
  if (tableScalars) {
    scalars = tableScalars;
  } else {
    // Chromium's font bounding box, not `hhea`: a font that pads its box beyond `hhea` carries the
    // padded box here. Advances and kerning are canvas-measured either way.
    const boxMetrics = ctx.measureText('Hxpqjy');
    scalars = {
      unitsPerEm: SYNTHETIC_UNITS_PER_EM,
      ascent: boxMetrics.fontBoundingBoxAscent,
      descent: boxMetrics.fontBoundingBoxDescent,
    };
    logger.info(
      `[SceneFont] Node "${nodePath}": font bytes are not a table-parseable SFNT (likely .woff2); using canvas fontBoundingBoxAscent/Descent as a measured approximation for ascent/descent -- see loadRuntimeFont's own doc for the measured error this carries.`
    );
  }

  return createRuntimeFontMetrics({ scalars, measureWidthUnits, cssFontFamily: family });
}

/** The async pipeline for one resolved `FontResource`. It never throws, and always returns usable `FontMetrics`. */
export async function resolveSceneFontMetrics(
  font: FontResource | null | undefined,
  nodePath: string
): Promise<FontMetrics> {
  if (!font) return OPEN_SANS_FONT_METRICS;

  const resolved = resolveFontFileBytes(font);
  if (!resolved) {
    warnUnresolvable(font, nodePath);
    return OPEN_SANS_FONT_METRICS;
  }

  const existing = metricsCache.get(resolved.leaf);
  if (existing?.status === 'settled') return existing.metrics;
  if (existing?.status === 'pending') return existing.promise;

  const promise: Promise<FontMetrics> = IS_VITEST
    ? Promise.resolve(OPEN_SANS_FONT_METRICS)
    : loadRuntimeFont(resolved.bytes, nodePath).catch((err: unknown) => {
        logger.warn(
          `[SceneFont] Node "${nodePath}": failed to load scene font (${err instanceof Error ? err.message : String(err)}). Falling back to the bundled default font.`
        );
        return OPEN_SANS_FONT_METRICS;
      });

  metricsCache.set(resolved.leaf, { status: 'pending', promise });
  const metrics = await promise;
  metricsCache.set(resolved.leaf, { status: 'settled', metrics });
  // Wakes a solve or paint pass that ran against the bundled fallback, so it reruns and reads the
  // settled cache.
  notifySceneFontMetricsSettled();
  return metrics;
}

/**
 * The synchronous entry for a solve pass: the bundled default while a load is in flight or failed,
 * the real metrics once it lands. Never throws. It starts `resolveSceneFontMetrics` once per font,
 * so calling both never double-loads.
 */
export function peekSceneFontMetrics(font: FontResource | null | undefined, nodePath: string): FontMetrics {
  if (!font) return OPEN_SANS_FONT_METRICS;

  const resolved = resolveFontFileBytes(font);
  if (!resolved) {
    warnUnresolvable(font, nodePath);
    return OPEN_SANS_FONT_METRICS;
  }

  const existing = metricsCache.get(resolved.leaf);
  if (existing?.status === 'settled') return existing.metrics;
  if (!existing) {
    void resolveSceneFontMetrics(font, nodePath);
  }
  return OPEN_SANS_FONT_METRICS;
}

/** Fixed, unlike a scene font's counter-suffixed name: there is exactly one bundled font and it is registered exactly once. */
const BUNDLED_FAMILY = 'tscn-bundled-open-sans-semibold';

let bundledRegistration: Promise<CanvasFontMetrics | undefined> | undefined;
/** Undefined until `document.fonts.add` resolves: `fillText` with an unregistered family paints a system font without failing. */
let bundledMetrics: CanvasFontMetrics | undefined;

function decodeBundledWoff2(): ArrayBuffer {
  const binary = atob(OPEN_SANS_WOFF2_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function registerBundledFont(): Promise<CanvasFontMetrics | undefined> {
  try {
    const doc = await registerFontFace(BUNDLED_FAMILY, decodeBundledWoff2);
    if (!doc) {
      logger.warn('[BundledFont] No FontFace/document.fonts in this environment; the bundled canvas-rasterised font is unavailable.');
      return undefined;
    }
    bundledMetrics = createOpenSansCanvasFontMetrics(BUNDLED_FAMILY);
    return bundledMetrics;
  } catch (err: unknown) {
    logger.warn(`[BundledFont] Failed to register the bundled font (${err instanceof Error ? err.message : String(err)}).`);
    return undefined;
  } finally {
    // Notifies on any settle, as the scene arm does, so a consumer that peeked re-renders once.
    notifySceneFontMetricsSettled();
  }
}

/** Registers the bundled font once, resolving to its canvas metrics, or `undefined` if the environment or the bytes cannot. Never throws. */
export function resolveBundledCanvasFontMetrics(): Promise<CanvasFontMetrics | undefined> {
  bundledRegistration ??= registerBundledFont();
  return bundledRegistration;
}

/** Synchronous answer for a solve/paint pass: the canvas metrics once registration resolved, `undefined` before that. Kicks the registration off on first call. */
export function peekBundledCanvasFontMetrics(): CanvasFontMetrics | undefined {
  if (!bundledMetrics) void resolveBundledCanvasFontMetrics();
  return bundledMetrics;
}
