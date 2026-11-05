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
import { peekBundledCanvasFace } from '../../../r3f/controls/native/text/bundledCanvasFace';
import {
  isBitmapFontMetrics,
  type BitmapFontMetrics,
} from '../../../r3f/controls/native/text/bitmapFontMetrics';
import {
  isCanvasFontMetrics,
  type CanvasFontMetrics,
} from '../../../r3f/controls/native/text/runtimeFontMetrics';
import {
  peekSettledChainFaces,
  peekSettledSceneFontMetrics,
  type SettledChainFace,
} from '../../../r3f/controls/native/text/sceneFontLoader';
import { withFallbacks, type FontMetrics } from '../../../r3f/controls/native/text/fontMetrics';
import { fontGeneratesMipmaps } from '../../../r3f/controls/native/text/sceneFontResolution';
import { useSceneFontSettleCount } from '../../../r3f/controls/native/text/useSceneFontSettleCount';
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
 * Undefined while the bundled font registers, or while the font file, the project font, the metrics
 * or, for an emboldened or sheared label, the outlines of the font load: nothing draws against
 * the wrong face meanwhile. A bundled font that cannot register leaves an atlas face undefined for good.
 */
export function useLabel3DFont(fontRef: string | undefined): Label3DFont | undefined {
  const resources = useSceneResources();
  const nodePath = useNodePath() ?? 'Label3D';
  const fontsPlan = useCallback(
    (loadedFont: LoadedFont) => resolveFontReference(fontRef, resources, loadedFont).paths,
    [fontRef, resources]
  );
  const { loadedFont, projectFonts, isLoading } = useLoadedFilesAndFonts(noFiles, fontsPlan, true);
  const { settings } = useProjectSettings();

  const settledFont = (): Label3DFont | undefined => {
    const font = fontForNode('Label3D', fontRef, { resources, loadedFont, projectFonts });
    const settled = peekSettledSceneFontMetrics(font, nodePath);
    if (!settled) return undefined;
    const projectMipmaps = projectDefaultFontGeneratesMipmaps(settings);
    const generatesMipmaps = fontGeneratesMipmaps(font) ?? projectMipmaps;
    // A chain face that reloads names no font for a while: its faces draw at the label's setting.
    const chainFaces = settled.fallbacks ? peekSettledChainFaces(font, nodePath) : null;
    const fallbackMipmaps = chainFaces
      ? fallbackFaceMipmaps(settled.fallbacks!, chainFaces, projectMipmaps)
      : NO_FALLBACK_MIPMAPS;
    if (isBitmapFontMetrics(settled)) return { metrics: settled, generatesMipmaps, fallbackMipmaps };
    // A canvas face carries its outlines already. An atlas face draws as the bundled canvas face,
    // which stands in for that face alone and so keeps its fallbacks.
    if (isCanvasFontMetrics(settled)) return { metrics: settled, generatesMipmaps, fallbackMipmaps };
    const canvasFace = peekBundledCanvasFace(settled);
    if (!canvasFace) return undefined;
    return { metrics: withFallbacks(canvasFace, settled.fallbacks ?? []), generatesMipmaps, fallbackMipmaps };
  };
  const label3DFont = isLoading ? undefined : settledFont();
  // Listens only while a face is missing: a label that has its font draws the same through every later settle.
  useSceneFontSettleCount(label3DFont === undefined);
  return label3DFont;
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
