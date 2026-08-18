/**
 * The one DOM-touching orchestrator in this font's pipeline: turns a
 * resolved `FontResource` (`resources/fonts/font/` — the
 * output of `styles/theme/lookup.ts`'s `resolveThemeFontIn`,
 * a CONCURRENT packet's own ancestor/type-chain walk over `SolveNode`'s
 * `fontOverrides`/`themeChain`/`projectTheme` fields — see this file's own
 * doc for the join-point contract) into a `FontMetrics` (`./fontMetrics.ts`),
 * or the bundled default when that is not possible. Never throws; never
 * leaves a caller with nothing to shape against (this repo's own rule: a
 * broken/missing/unsupported font falls back to the bundled default and
 * renders something, matching Godot's own theme-default fallback).
 *
 * ## The bundled default's own registration
 *
 * The bundled Open Sans SemiBold goes through the SAME door here
 * (`peekBundledCanvasFontMetrics`/`resolveBundledCanvasFontMetrics`), not a
 * module of its own: registering a `FontFace` and notifying the settled
 * channel below are one mechanism, and a second copy of either would be a
 * second, silently-diverging one. Its `'canvas'`-kind metrics
 * (`openSansCanvasFontMetrics.ts`) are `undefined` until `document.fonts.add`
 * has happened, because `ctx.fillText` with an UNREGISTERED family does not
 * fail — it silently rasterises a SYSTEM font, whose pixels are frame-stable
 * enough for a visual harness to settle on and capture. Withholding the
 * metrics until registration resolves is what makes that unreachable.
 *
 * ## The CSP-validated door
 *
 * `default-src 'none'`, no `connect-src`/`font-src`/`worker-src` — no
 * fetch/XHR of any URL (a `data:`/`blob:` one included: the CSP blocks the
 * FETCH, not the bytes' origin), no blob-URL worker, no eval, no WASM. The
 * validated path is `new FontFace(name, arrayBuffer)` + `document.fonts.add`
 * (bytes already in hand — `resolveFontFileBytes` pulled them out of the
 * ALREADY-LOADED `FontResource`, itself fetched by this repo's existing
 * resource pipeline, `useResource`'s own `'Font'` type) then canvas-2D
 * `measureText` against that registered family — never a fetch, a worker, or
 * a blob URL anywhere on this path. Each font gets a fresh, counter-suffixed
 * internal family name so two scene fonts (or two loads of the same font
 * across re-renders) can never collide in `document.fonts`.
 *
 * ## Why NOT reachable under this repo's own vitest suite
 *
 * happy-dom (this monorepo's vitest environment) exposes neither `FontFace`
 * nor a real `CanvasRenderingContext2D` (`canvasTextPainter.ts`'s own doc:
 * `HTMLCanvasElement#getContext('2d')` returns `null`). Rather than reaching
 * for jsdom/happy-dom canvas polyfills that would not exercise real
 * font-shaping behaviour anyway, this module follows the SAME precedent
 * `r3f/internalTextLabel.tsx` already established for drei's CDN-fetching
 * `<Text>` (`IS_VITEST`, detected via `process.env.VITEST`): short-circuit
 * to the bundled default BEFORE touching any DOM font API, silently — this
 * is a deliberate skip, not a load failure, so it does not warn (contrast
 * a REAL `FontFace`/canvas-unavailable environment, which does warn — see
 * `loadRuntimeFont`'s own doc). `sfntTables.ts` and `runtimeFontMetrics.ts`
 * are both pure and fully unit-tested; this module's own test file covers
 * every DOM-INDEPENDENT branch (missing font, `SystemFont`, an unresolvable
 * `.tres` chain, the warn-once dedupe, the sync peek/cache contract) and
 * documents which branch is untestable here and why.
 *
 * ## The join-point contract
 *
 * `text/resolveNodeFontMetrics.ts`'s `resolveNodeFontMetrics(solveNode,
 * themeKey)` is the seam every widget's solver/painter actually calls — it
 * wraps `theme/lookup.ts`'s `resolveThemeFontIn` (walking
 * `solveNode.fontOverrides`/`.themeChain`/`.projectTheme`) and THIS module's
 * own `peekSceneFontMetrics` in one place. `peekSceneFontMetrics(font,
 * nodePath)` itself is the ONE call a synchronous solve pass
 * (`nativeSolver.ts`, pure per-node math, no hooks) needs: it ALWAYS returns
 * synchronously — the bundled default while a real load is still in flight or
 * failed, the real `CanvasFontMetrics` once one lands — and never throws. No
 * `await`, no hook, no effect at the call site.
 *
 * ## Re-solve/re-render on arrival
 *
 * A font resolves asynchronously, so the FIRST solve/paint of a node
 * necessarily uses the bundled fallback — and a consumer that peeks the
 * BUNDLED canvas metrics before their registration resolves is in exactly
 * the same position, which is why both arms fire the one channel below.
 * `onSceneFontMetricsSettled` is this
 * module's half of the SAME generation-bump mechanism `buildSolveTree.ts`
 * already uses for a texture/scene/theme/font-RESOURCE arrival (`generation`,
 * bumped from `loader.eventBus` listeners in a `useEffect`) — not a second,
 * parallel re-render channel: `useBuildSolveTree.ts` subscribes to this
 * listener list in the SAME effect, calling the SAME `bump`, so a runtime
 * metrics settling forces the identical re-walk → re-solve → re-paint a
 * texture arrival already does. `resolveSceneFontMetrics(font, nodePath)` is
 * the same work as a `Promise` a caller that DOES want to await completion
 * can use instead; `peek` calls it internally as a fire-and-forget kickoff,
 * so calling both for the same `font` never double-loads.
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

// Same detection `r3f/internalTextLabel.tsx` already uses for its own
// DOM/network-dependent path — see this module's own doc for why the check
// (rather than a real FontFace-availability probe) is what decides the
// SILENT skip.
const IS_VITEST = (() => {
  const proc = (globalThis as { process?: { env?: { VITEST?: string } } }).process;
  return proc?.env?.VITEST === 'true';
})();

/** Arbitrary, self-consistent "design units per em" for a font this module cannot table-parse (a `.woff2`, or any other signature `sfntTables.ts` does not recognise) — see `loadRuntimeFont`'s own doc for why the CHOICE of value is arbitrary as long as every measurement (ascent/descent AND every advance/kerning query) is taken at this SAME reference size. */
const SYNTHETIC_UNITS_PER_EM = 1000;

let familyCounter = 0;

/** A no-argument re-render trigger — see `onSceneFontMetricsSettled`'s own doc. */
export type SceneFontMetricsListener = () => void;

const settledListeners = new Set<SceneFontMetricsListener>();

/**
 * Subscribes to "a runtime font metrics load just settled" — a scene font's,
 * or the bundled font's own registration. This is this
 * module's own half of the SAME generation-bump mechanism
 * `buildSolveTree.ts` already uses for a texture/scene/theme/font-resource
 * arrival (this file's own doc, "Re-solve/re-render on arrival"). Fires once
 * per resource the FIRST time its `resolveSceneFontMetrics` promise settles
 * (success or fallback — see the call site below), and once for the bundled
 * registration; never for a font that short-circuits synchronously
 * (`null`/`undefined`, or an unresolvable resource caught by
 * `warnUnresolvable` before any async work starts) since nothing there can
 * later change value.
 *
 * Returns an unsubscribe function, the same shape `ResourceEventBus.on`'s
 * callers already unwind via their own `off` call in a `useEffect` cleanup.
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

/** Keyed by the RESOLVED leaf `FontFileResource` (the one that actually carries bytes) — two nodes referencing the same underlying font share one registration/load, matching this codebase's resource-loader caching (`useResource.ts`'s own doc: the same resource object is reused across consumers of the same address). A `WeakMap` so an evicted/replaced resource's cache entry is not a permanent leak. */
const metricsCache = new WeakMap<FontFileResource, CacheEntry>();

/** Dedupe: warn at most once per unresolvable-font RESOURCE OBJECT, not once per call — `peekSceneFontMetrics` runs on every solve pass (every render), and this failure mode (SystemFont, a broken `.tres` chain) is a property of the resource itself, not of any one frame. */
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
 * The CSP-validated door itself (this file's own doc): `new FontFace(name,
 * arrayBuffer)` + `document.fonts.add`, never a fetch. Both arms of this
 * module — a scene font and the bundled default — register through here.
 *
 * Read off `globalThis` lazily, not as a module-scope binding: a non-DOM
 * environment then answers `undefined` instead of throwing a `ReferenceError`
 * on the bare global, and a host that installs `document.fonts` after this
 * module loads is still seen.
 *
 * Resolves to the `Document` the face was added to, `undefined` where the
 * environment has no `FontFace`/`document.fonts` at all; REJECTS only when
 * the bytes themselves are not a loadable font. Callers distinguish the two
 * (an absent environment is not a broken font) — hence `bytes` as a thunk:
 * decoding must not run, nor misreport its own failure as a broken font,
 * where there is no door to register through anyway.
 */
async function registerFontFace(family: string, bytes: () => ArrayBuffer): Promise<Document | undefined> {
  const { FontFace: FontFaceCtor, document: doc } = globalThis as { FontFace?: typeof FontFace; document?: Document };
  if (!FontFaceCtor || !doc?.fonts) return undefined;
  const face = new FontFaceCtor(family, bytes());
  await face.load();
  doc.fonts.add(face);
  return doc;
}

/**
 * Registers `bytes` as a fresh `FontFace`, builds its `CanvasFontMetrics`.
 * Throws on a genuinely invalid font (`FontFace#load()` rejects) — the
 * caller (`loadSceneFontMetrics`) is the one that catches and falls back.
 *
 * Ascent/descent: `sfntTables.ts`'s real `head`/`hhea` read when the bytes
 * are a plain SFNT; otherwise (a `.woff2` this repo cannot Brotli-decompress
 * — `sfntTables.ts`'s own doc) canvas `TextMetrics.fontBoundingBoxAscent`/
 * `.fontBoundingBoxDescent` at `SYNTHETIC_UNITS_PER_EM` px, MEASURED (not
 * assumed) to be an exact stand-in at that reference size: a scratch
 * Playwright/Chromium probe against a real corpus `.woff2`
 * (`Recursive_VF_subset-GF_latin_basic.woff2`) found `fontBoundingBoxAscent`/
 * `Descent` measured at 1000px matched the font's OWN real `hhea`
 * ascent/descent (independently read via `fontkit` after decompressing the
 * SAME file with `wawoff2`, exactly as `bake-metrics.mjs` does at build
 * time) to WITHIN 0 units — zero measured delta. The SAME probe measured at
 * a realistic UI size (16px) instead found a 12.5-unit ascent delta (one
 * whole pixel after `getFontAscentPx`'s ceiling rounding: 16px vs the true
 * 16px, and DIVERGING further at 42px to a 2-unit ascent / 12-unit descent
 * delta) — small-size canvas text metrics are internally pixel-snapped by
 * Chromium, which a large reference size avoids entirely. This IS still a
 * real, residual parity limitation for a `.woff2` scene font, distinct from
 * the measured-exact case above: `fontBoundingBoxAscent`/`Descent` is
 * Chromium's OWN font-bounding-box computation, not FreeType's `hhea` —
 * for the ONE corpus font measured, the two coincide at this reference
 * size; a font whose author deliberately padded its bounding box beyond
 * `hhea` (some fonts do, for line-height purposes) would carry this
 * fallback's own box instead of Godot's `hhea`-derived one, with no way for
 * this module to tell the difference. Advances/kerning are unaffected
 * either way (`runtimeFontMetrics.ts`'s own doc: always canvas-measured).
 */
async function loadRuntimeFont(bytes: ArrayBuffer, nodePath: string): Promise<CanvasFontMetrics> {
  const family = `tscn-scene-font-${++familyCounter}`;
  const doc = await registerFontFace(family, () => bytes);
  if (!doc) {
    // Same warn-then-throw shape as the no-2D-context branch below: a real
    // environment that cannot register a font is a genuine fallback.
    logger.warn(`[SceneFont] Node "${nodePath}": no FontFace/document.fonts in this environment; falling back to the bundled default font.`);
    throw new Error('FontFace unavailable');
  }

  const tableScalars = parseSfntScalars(bytes);

  const measureCanvas = doc.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) {
    // Real-browser-unreachable in practice (every supported browser has a 2D
    // context) but a genuine, warn-worthy fallback if it ever happens — NOT
    // the same thing as the IS_VITEST short-circuit above (that skip never
    // reaches this function at all).
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

/**
 * The full async pipeline for one resolved `FontResource`: never throws,
 * never returns anything but a usable `FontMetrics` — see this module's own
 * doc for the fallback/warn contract and the join-point this function (and
 * `peekSceneFontMetrics`) exist for.
 */
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
  // Wakes any solve/paint pass that already ran against the bundled
  // fallback (`peekSceneFontMetrics`'s synchronous first answer) so it reruns
  // and picks up `metrics` from the now-settled cache — see this module's own
  // doc, "Re-solve/re-render on arrival".
  notifySceneFontMetricsSettled();
  return metrics;
}

/**
 * Synchronous entry point for a solve pass (`nativeSolver.ts`'s own
 * per-node math, no hooks) — see this module's own doc for the full
 * join-point contract. Always returns immediately; kicks off
 * `resolveSceneFontMetrics` in the background the first time a given font
 * resource is seen (idempotent — a pending/settled entry is never re-kicked).
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
    // Any settle, exactly as the scene arm notifies after its own `.catch`
    // has turned a failure into the fallback: a peek-then-settle consumer
    // re-renders once and reads whatever the peek now answers.
    notifySceneFontMetricsSettled();
  }
}

/** Registers the bundled font once, resolving to its canvas metrics — or `undefined` if this environment or the bytes cannot. Never throws. */
export function resolveBundledCanvasFontMetrics(): Promise<CanvasFontMetrics | undefined> {
  bundledRegistration ??= registerBundledFont();
  return bundledRegistration;
}

/** Synchronous answer for a solve/paint pass: the canvas metrics once registration resolved, `undefined` before that. Kicks the registration off on first call. */
export function peekBundledCanvasFontMetrics(): CanvasFontMetrics | undefined {
  if (!bundledMetrics) void resolveBundledCanvasFontMetrics();
  return bundledMetrics;
}
