/**
 * The font a Label3D shapes and paints with, as the font chain resolves it (`label_3d.cpp:812-850`).
 * Label3D rasterises with canvas-2D or draws a BMFont's page images, so a font whose metrics are
 * neither, the bundled default or a FontVariation over it, draws as the bundled canvas face.
 */

import { useCallback } from 'react';
import { projectDefaultFontGeneratesMipmaps } from '../../../parser/projectSettingsParser';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useBundledCanvasFace } from '../../../r3f/controls/native/text/bundledCanvasFace';
import {
  isBitmapFontMetrics,
  type BitmapFontMetrics,
} from '../../../r3f/controls/native/text/bitmapFontMetrics';
import {
  isCanvasFontMetrics,
  type CanvasFontMetrics,
} from '../../../r3f/controls/native/text/runtimeFontMetrics';
import type { SettledChainFace } from '../../../r3f/controls/native/text/settledFonts';
import { withFallbacks, type FontMetrics } from '../../../r3f/controls/native/text/fontMetrics';
import { settledOrBundled } from '../../../r3f/controls/native/text/sceneFontLoader';
import { fontGeneratesMipmaps } from '../../../r3f/controls/native/text/sceneFontResolution';
import { usePreviewFontSettles, useSettledFont } from '../../../r3f/controls/native/text/useSettledFont';
import { resolveFontReference } from '../../../resources/fonts/font/resolveFontReference';
import { fontForNode } from '../../../resources/styles/theme/lookup';
import type { LoadedFont } from '../../../resources/scopedResource';
import { useLoadedFilesAndFonts } from '../../../resources/useLoadedFilesAndFonts';

/** A Label3D reads no file but its fonts. */
const noFiles = () => [];

export interface Label3DFont {
  metrics: CanvasFontMetrics | BitmapFontMetrics;
  /** Whether the glyph raster carries a mip chain: the font's own setting, or the project's for the bundled font. */
  generatesMipmaps: boolean;
  /** The same for each fallback face, by the metrics its glyphs draw with: each FontFile builds its own glyph textures. */
  fallbackMipmaps: ReadonlyMap<FontMetrics, boolean>;
}

/**
 * Undefined while the font file, the project font, the metrics or the outlines of the bundled font
 * load: nothing draws against the wrong face meanwhile. Null for a bundled font whose outlines
 * cannot be read, which draws nothing and loads nothing more.
 */
export function useLabel3DFont(fontRef: string | undefined): Label3DFont | null | undefined {
  const resources = useSceneResources();
  const nodePath = useNodePath() ?? 'Label3D';
  const fontsPlan = useCallback(
    (loadedFont: LoadedFont) => resolveFontReference(fontRef, resources, loadedFont).paths,
    [fontRef, resources]
  );
  const { loadedFont, projectFonts, isLoading } = useLoadedFilesAndFonts(noFiles, fontsPlan, true);
  const { settings } = useProjectSettings();
  const peekBundledCanvasFace = useBundledCanvasFace();
  const font = isLoading
    ? undefined
    : fontForNode('Label3D', fontRef, { resources, loadedFont, projectFonts });
  const settled = useSettledFont(font, nodePath);

  /** The font the label draws with: undefined while its chain or the bundled canvas face loads. */
  const label3DFont = (): Label3DFont | null | undefined => {
    const drawn = settledOrBundled(settled);
    if (!drawn) return undefined;
    const projectMipmaps = projectDefaultFontGeneratesMipmaps(settings);
    const generatesMipmaps = fontGeneratesMipmaps(font ?? null) ?? projectMipmaps;
    const { fallbacks } = drawn.face;
    const fallbackMipmaps = fallbacks
      ? fallbackFaceMipmaps(fallbacks, drawn.chain, projectMipmaps)
      : NO_FALLBACK_MIPMAPS;
    // A bitmap face draws its page images and a canvas face carries its outlines, so each draws as it
    // is. The bundled face draws as the bundled canvas face, which stands in for that face alone and
    // so keeps its fallbacks.
    if (isBitmapFontMetrics(drawn.face) || isCanvasFontMetrics(drawn.face))
      return { metrics: drawn.face, generatesMipmaps, fallbackMipmaps };
    const canvasFace = peekBundledCanvasFace(drawn.face);
    if (!canvasFace) return canvasFace;
    return { metrics: withFallbacks(canvasFace, fallbacks ?? []), generatesMipmaps, fallbackMipmaps };
  };
  const drawn = isLoading ? undefined : label3DFont();
  // The bundled canvas face loads apart from the font: listen to this preview's settles while it does.
  usePreviewFontSettles(!isLoading && drawn === undefined && settled.status !== 'loading');
  return drawn;
}

const NO_FALLBACK_MIPMAPS: ReadonlyMap<FontMetrics, boolean> = new Map();

/**
 * The `generate_mipmaps` of each fallback face the shaper draws with (`FontMetrics.fallbacks`), from
 * the font of the first chain face with those metrics, as the first face that has a glyph draws it.
 */
function fallbackFaceMipmaps(
  fallbacks: readonly FontMetrics[],
  chainFaces: readonly SettledChainFace[],
  projectMipmaps: boolean
): ReadonlyMap<FontMetrics, boolean> {
  return new Map(
    fallbacks.map((metrics) => {
      const font = chainFaces.find((face) => face.metrics === metrics)?.font ?? null;
      return [metrics, fontGeneratesMipmaps(font) ?? projectMipmaps];
    })
  );
}
