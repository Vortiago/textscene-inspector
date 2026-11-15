/** What a viewport gives each render it draws, and the project's adapter for the root viewport. */

import type { PositionalShadowAtlasSettings } from '../../godot/rendering/lights/positionalShadowAtlas.js';
import {
  projectAnisotropicFilteringLevel,
  projectMsaaModes,
  projectPositionalShadowAtlas,
  projectTextureMipmapBias,
  projectTransparentBackground,
  projectUsesDebanding,
  type ProjectSettings,
} from '../../parser/projectSettingsParser.js';

/**
 * The three rules are fields, not a kind of viewport: the In-game view is a root viewport with the
 * game's rules.
 */
export interface ViewportDescription {
  msaa2D: number;
  msaa3D: number;
  usesDebanding: boolean;
  transparentBackground: boolean;
  mipmapBias: number;
  positionalShadowAtlas: PositionalShadowAtlasSettings;
  anisotropicLevel: number;
  /** `editor`: the user's free camera, or the previewed Camera3D. `elected`: the viewport's current camera. */
  camera: 'editor' | 'elected';
  drawsEditorChrome: boolean;
  /** Whether the editor's preview sun and preview Environment stand in (ADR-0025). */
  previewsEnvironment: boolean;
}

/** The root viewport as the editor draws it: its facts from the project, and the editor's rules. */
export function rootViewportDescription(settings: ProjectSettings | null): ViewportDescription {
  const { msaa2D, msaa3D } = projectMsaaModes(settings);
  return {
    msaa2D,
    msaa3D,
    usesDebanding: projectUsesDebanding(settings),
    transparentBackground: projectTransparentBackground(settings),
    mipmapBias: projectTextureMipmapBias(settings),
    positionalShadowAtlas: projectPositionalShadowAtlas(settings),
    anisotropicLevel: projectAnisotropicFilteringLevel(settings),
    camera: 'editor',
    drawsEditorChrome: true,
    previewsEnvironment: true,
  };
}
