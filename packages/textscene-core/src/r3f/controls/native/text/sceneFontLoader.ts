/**
 * Turns a resolved `FontResource` into `FontMetrics`, or into the bundled default when that fails.
 * It peeks the load of each face of the **Fallback chain** through the settled fonts of a preview
 * (`settledFonts.ts`), and it never throws.
 */
import { withFallbacks, withVariation, type FontMetrics, type GlyphVariation } from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import {
  BUNDLED_FACE,
  NO_FACE,
  fallbackChain,
  findDrawnFace,
  fontVariationEmbolden,
  fontVariationOpentype,
  fontVariationSkew,
  hasBitmap,
} from './sceneFontResolution';
import { createBitmapFontMetrics } from './bitmapFontMetrics';
import { NO_FACE_METRICS } from './noFaceMetrics';
import { perObject } from '../../../../utils/perObject';
import type { FontResource } from '../../../../resources/fonts/font/types';
import { warnOnce } from '../../../../utils/warnOnce';
import type { SettledChainFace, SettledFont, SettledFonts } from './settledFonts';
import { drawLoad, peekOutlines } from './sceneFontOutlines';

/** One `BitmapFontMetrics` for each decoded BMFont, so a layout memoised on its identity keeps its hits. */
const bitmapMetricsOf = perObject(createBitmapFontMetrics);

/** Warns once per unresolvable resource, not per call: the peek runs on every solve pass, and the failure belongs to the resource. */
function warnUnresolvable(font: FontResource, nodePath: string): void {
  warnOnce(
    font,
    'unresolvable',
    `[SceneFont] Node "${nodePath}": font resource is unresolvable (no FontFile in its fallback chain carries loadable bytes). Falling back to the bundled default font, or to the next font of its fallback chain.`
  );
}

/** The embolden, skew and OpenType axes of `font`, when it is a `FontVariation`. */
function fontVariation(font: FontResource): GlyphVariation {
  return {
    embolden: fontVariationEmbolden(font),
    skew: fontVariationSkew(font),
    opentype: fontVariationOpentype(font),
  };
}

const NO_FONT: SettledFont = { status: 'none' };
const LOADING: SettledFont = { status: 'loading' };

/**
 * `font` with the settled faces of its whole **Fallback chain**, each face with its `FontVariation`
 * embolden and skew on top. Loading while a load is in flight, which marks `font` so the settle
 * wakes its readers. A font that cannot load, or has no bytes to load, settles at once on the
 * bundled default, and a fallback that cannot load drops out. No font is `none`.
 */
export function readSettledFont(
  fonts: SettledFonts,
  font: FontResource | null | undefined,
  nodePath: string
): SettledFont {
  if (!font) return NO_FONT;
  const kept = fonts.settled.get(font);
  if (kept) return kept;
  const { value: chain, pending } = fonts.pendingLoadsOf(() => settledChainFaces(fonts, font, nodePath));
  if (!chain) {
    fonts.awaitFont(font, pending);
    return LOADING;
  }
  const [face, ...fallbacks] = chain.map(({ metrics }) => metrics);
  const settled = { status: 'settled', face: withFallbacks(face!, fallbacks), chain } as const;
  fonts.settled.set(font, settled);
  return settled;
}

/** What no font draws: the bundled font's face, alone in its chain. */
export const BUNDLED_SETTLED_FONT: SettledFont & { status: 'settled' } = {
  status: 'settled',
  face: OPEN_SANS_FONT_METRICS,
  chain: [{ font: null, metrics: OPEN_SANS_FONT_METRICS }],
};

/**
 * The metrics of `font` once its whole chain has settled, and null while a load is in flight. No
 * font draws the bundled default. A consumer that must not draw against the default while the real
 * font loads reads this one.
 */
export function peekSettledSceneFontMetrics(
  fonts: SettledFonts,
  font: FontResource | null | undefined,
  nodePath: string
): FontMetrics | null {
  const settled = readSettledFont(fonts, font, nodePath);
  if (settled.status === 'none') return BUNDLED_SETTLED_FONT.face;
  return settled.status === 'settled' ? settled.face : null;
}

/**
 * The settled faces of the **Fallback chain** of `font`, the drawn face first, and null while a
 * load is in flight. A consumer that reads more of each face than its metrics, such as its
 * outlines, starts from this list.
 */
export function peekSettledChainFaces(
  fonts: SettledFonts,
  font: FontResource | null | undefined,
  nodePath: string
): readonly SettledChainFace[] | null {
  const settled = readSettledFont(fonts, font, nodePath);
  if (settled.status === 'none') return BUNDLED_SETTLED_FONT.chain;
  return settled.status === 'settled' ? settled.chain : null;
}

/** The faces of the chain of `font` once each has settled, as `readSettledFont` composes them. */
function settledChainFaces(
  fonts: SettledFonts,
  font: FontResource,
  nodePath: string
): readonly SettledChainFace[] | null {
  const ownChain = fallbackChain(font);
  const chain = ownChain.length > 0 ? ownChain : [font];
  const faces = chain.map((entry) => peekFace(fonts, entry, nodePath));
  if (faces.includes(null)) return null;
  return chain.flatMap((entry, i): SettledChainFace[] => {
    const metrics = faces[i]!;
    if (metrics !== MISSING_FACE) return [{ font: entry, metrics }];
    // The bundled font draws in its place, with the variation the font still names.
    return i === 0
      ? [
          {
            font: entry,
            metrics: withVariation(OPEN_SANS_FONT_METRICS, fontVariation(entry)),
            isStandIn: true,
          },
        ]
      : [];
  });
}

/**
 * A face with none of its own: none resolves, or its load failed. The first face of a chain draws the
 * bundled default in its place, and a fallback drops out of its chain.
 */
const MISSING_FACE = Symbol('missing face');

/**
 * The settled metrics of the face `font` draws alone: {@link MISSING_FACE} when it has none, and null
 * while a load is in flight.
 */
function peekFace(
  fonts: SettledFonts,
  font: FontResource,
  nodePath: string
): FontMetrics | typeof MISSING_FACE | null {
  const face = findDrawnFace(font);
  // No failure, so no warning: Godot draws the bundled font here too.
  if (face === BUNDLED_FACE) return withVariation(OPEN_SANS_FONT_METRICS, fontVariation(font));
  if (face === NO_FACE) return NO_FACE_METRICS;
  if (!face) {
    warnUnresolvable(font, nodePath);
    return MISSING_FACE;
  }

  // A BMFont is decoded by the time its resource settles, so it needs no load of its own. Only the
  // embolden of a variation reaches it: FreeType shears and emboldens an outline, and it has none.
  if (hasBitmap(face))
    return withVariation(bitmapMetricsOf(face.bitmap), { embolden: fontVariationEmbolden(font) });

  const metrics = fonts.peekFace(face.bytes, nodePath);
  if (metrics === undefined) return null;
  if (metrics === null) return MISSING_FACE;
  const variation = fontVariation(font);
  // A canvas face draws every glyph from its outline.
  const outlines = peekOutlines(fonts, face, drawLoad(face));
  return outlines === undefined ? null : withVariation(metrics, { ...variation, outlines });
}

/**
 * The synchronous entry for a solve pass: the bundled default while a load is in flight or failed,
 * the real metrics once it lands. Never throws.
 */
export function peekSceneFontMetrics(
  fonts: SettledFonts,
  font: FontResource | null | undefined,
  nodePath: string
): FontMetrics {
  return peekSettledSceneFontMetrics(fonts, font, nodePath) ?? OPEN_SANS_FONT_METRICS;
}
