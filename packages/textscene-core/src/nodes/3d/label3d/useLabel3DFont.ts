/**
 * The font a Label3D shapes and paints with, as the font chain resolves it (`label_3d.cpp:812-850`).
 * Label3D rasterises with canvas-2D, so a font whose metrics are not canvas metrics, the bundled
 * default or a FontVariation over it, draws as the bundled canvas face.
 */

import { useCallback } from 'react';
import { projectDefaultFontGeneratesMipmaps } from '../../../parser/projectSettingsParser';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { peekBundledCanvasFontMetrics } from '../../../r3f/controls/native/text/bundledFontLoader';
import { withVariation } from '../../../r3f/controls/native/text/fontMetrics';
import {
  isCanvasFontMetrics,
  type CanvasFontMetrics,
} from '../../../r3f/controls/native/text/runtimeFontMetrics';
import { peekSettledSceneFontMetrics } from '../../../r3f/controls/native/text/sceneFontLoader';
import { peekEmboldenedStrokeOutlines } from '../../../r3f/controls/native/text/sceneFontOutlines';
import { fontGeneratesMipmaps } from '../../../r3f/controls/native/text/sceneFontResolution';
import type { SfntOutlines } from '../../../r3f/controls/native/text/sfntOutlines';
import { useSceneFontSettleCount } from '../../../r3f/controls/native/text/useSceneFontSettleCount';
import { resolveFontReference } from '../../../resources/fonts/font/resolveFontReference';
import type { FontResource } from '../../../resources/fonts/font/types';
import { fontForNode } from '../../../resources/styles/theme/lookup';
import type { LoadedFont } from '../../../resources/scopedResource';
import { FONT_FILES, useCachedFiles } from '../../../resources/useLoadedFiles';
import { useProjectFonts } from '../../../resources/useProjectFonts';

export interface Label3DFont {
  metrics: CanvasFontMetrics;
  /** The glyph outlines that an emboldened outline ring follows. Null where the label needs none, or the font has none to read. */
  outlines: SfntOutlines | null;
  /** Whether the glyph raster carries a mip chain: the font's own setting, or the project's for the bundled font. */
  generatesMipmaps: boolean;
}

/**
 * Undefined while the bundled font registers, or while the font file, the project font, the metrics
 * or, for an emboldened label with an outline, the outlines of the font load: nothing draws against
 * the wrong face meanwhile.
 */
export function useLabel3DFont(fontRef: string | undefined, hasOutline: boolean): Label3DFont | undefined {
  const resources = useSceneResources();
  const nodePath = useNodePath() ?? 'Label3D';
  const plan = useCallback(
    (loadedFont: LoadedFont) => resolveFontReference(fontRef, resources, loadedFont).paths,
    [fontRef, resources]
  );
  const { loadedFile: loadedFont, isLoading: isLoadingFont } = useCachedFiles<FontResource>(FONT_FILES, plan);
  const { projectFonts, isLoading: isLoadingProjectFonts } = useProjectFonts(true);
  const { settings } = useProjectSettings();

  const bundled = peekBundledCanvasFontMetrics();
  const settledFont = (): Label3DFont | undefined => {
    if (!bundled) return undefined;
    const font = fontForNode('Label3D', fontRef, { resources, loadedFont, projectFonts });
    const settled = peekSettledSceneFontMetrics(font, nodePath);
    if (!settled) return undefined;
    const metrics = isCanvasFontMetrics(settled) ? settled : withVariation(bundled, settled);
    const outlines = peekEmboldenedStrokeOutlines(font, metrics, hasOutline);
    if (outlines === undefined) return undefined;
    return {
      metrics,
      outlines,
      generatesMipmaps: fontGeneratesMipmaps(font) ?? projectDefaultFontGeneratesMipmaps(settings),
    };
  };
  const label3DFont = isLoadingFont || isLoadingProjectFonts ? undefined : settledFont();
  // Listens only while a face is missing: a label that has its font draws the same through every later settle.
  useSceneFontSettleCount(label3DFont === undefined);
  return label3DFont;
}
