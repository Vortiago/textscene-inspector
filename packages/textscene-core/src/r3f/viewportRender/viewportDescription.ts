import type { PositionalShadowAtlasSettings } from '../../godot/rendering/lights/positionalShadowAtlas.js';
import {
  DEFAULT_ANISOTROPIC_FILTERING_LEVEL,
  VIEWPORT_POSITIONAL_SHADOW_ATLAS,
  viewportPositionalShadowAtlas,
} from '../../godot/scene/viewport.js';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types.js';
import {
  projectAnisotropicFilteringLevel,
  projectMsaaModes,
  projectPositionalShadowAtlas,
  projectTextureMipmapBias,
  projectTransparentBackground,
  projectUsesDebanding,
  type ProjectSettings,
} from '../../parser/projectSettingsParser.js';

/** Rules are fields, not a kind: the In-game view is a root viewport with the game's rules. */
export interface ViewportDescription {
  msaa2D: number;
  msaa3D: number;
  usesDebanding: boolean;
  transparentBackground: boolean;
  mipmapBias: number;
  positionalShadowAtlas: PositionalShadowAtlasSettings;
  anisotropicLevel: number;
  /** `editor`: the free or previewed camera. `elected`: the viewport's current camera. */
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

/** The node's properties the SubViewport adapter reads. */
type SubViewportFacts = Pick<
  SubViewportProperties,
  | 'msaa_2d'
  | 'msaa_3d'
  | 'use_debanding'
  | 'use_hdr_2d'
  | 'transparent_bg'
  | 'texture_mipmap_bias'
  | 'anisotropic_filtering_level'
  | 'positional_shadow_atlas_size'
  | 'positional_shadow_atlas_quad_0'
  | 'positional_shadow_atlas_quad_1'
  | 'positional_shadow_atlas_quad_2'
  | 'positional_shadow_atlas_quad_3'
>;

/** A SubViewport as the game draws it. An unset bias or anisotropic level takes `root`'s. */
export function subViewportDescription(
  properties: SubViewportFacts,
  root: ViewportDescription
): ViewportDescription {
  return {
    msaa2D: properties.msaa_2d,
    msaa3D: properties.msaa_3d,
    // A half-float target holds no banding to dither (`renderer_scene_render_rd.cpp:941`).
    usesDebanding: properties.use_debanding && !properties.use_hdr_2d,
    transparentBackground: properties.transparent_bg,
    mipmapBias: properties.texture_mipmap_bias ?? root.mipmapBias,
    positionalShadowAtlas: viewportPositionalShadowAtlas(
      properties.positional_shadow_atlas_size,
      [
        properties.positional_shadow_atlas_quad_0,
        properties.positional_shadow_atlas_quad_1,
        properties.positional_shadow_atlas_quad_2,
        properties.positional_shadow_atlas_quad_3,
      ],
      VIEWPORT_POSITIONAL_SHADOW_ATLAS
    ),
    anisotropicLevel: properties.anisotropic_filtering_level ?? root.anisotropicLevel,
    camera: 'elected',
    drawsEditorChrome: false,
    previewsEnvironment: false,
  };
}

/** A probe face samples with Godot's default samplers (`render_forward_clustered.cpp:1824`, `material_storage.h:370`). */
export function probeCaptureDescription(viewport: ViewportDescription): ViewportDescription {
  return { ...viewport, mipmapBias: 0, anisotropicLevel: DEFAULT_ANISOTROPIC_FILTERING_LEVEL };
}
