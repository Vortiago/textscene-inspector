/**
 * Godot's editor preview lighting (ADR-0025): a scene with no sun gets the preview
 * sun and one with no environment the preview environment, each yielding on its
 * own. At runtime Godot adds neither. Values from `Node3DEditor::_load_default_preview_settings`
 * and `_preview_settings_changed`, the yield rule from `_node_added`.
 */

import * as THREE from 'three';
import type { TscnNode } from '../../parser/types';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { DEFAULT_CLEAR_COLOR } from '../../godot/rendering';
import { lerpColor } from '../../godot/math';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { decodeSky, decodeSkyMaterial } from '../../resources/sky/decode';
import type { ProceduralSkyProperties, Sky } from '../../resources/sky/types';
import { decodeEnvironment } from '../../resources/environment/decode';
import type { Rgba } from '../../godot/math';

/** The node types the editor counts, one independent counter each. */
export const PREVIEW_SUN_YIELD_TYPE = 'DirectionalLight3D';
export const PREVIEW_ENVIRONMENT_YIELD_TYPE = 'WorldEnvironment';

/**
 * "These default rotations place the preview sun at an angular altitude of 60
 * degrees (must be negative) and an azimuth of 30 degrees clockwise from north
 * (or 150 CCW from south), from north east, facing south west."
 */
const PREVIEW_SUN_ALTITUDE_DEG = -60;
const PREVIEW_SUN_AZIMUTH_DEG = 150;

/** Godot's preview sun is white at energy 1.0 with shadows enabled. */
export const PREVIEW_SUN_COLOR = 0xffffff;
export const PREVIEW_SUN_ENERGY = 1;
export const PREVIEW_SUN_SHADOW_MAX_DISTANCE = 100;

const PREVIEW_SKY_TOP: Rgba = { r: 0.385, g: 0.454, b: 0.55, a: 1 };
const PREVIEW_GROUND_BOTTOM: Rgba = { r: 0.2, g: 0.169, b: 0.133, a: 1 };

/**
 * The nodes Godot's two counters watch. A stable module-level predicate: the
 * live-tree hook memoises on it.
 */
export const YIELDS_A_PREVIEW = (node: TscnNode): boolean =>
  node.type === PREVIEW_SUN_YIELD_TYPE || node.type === PREVIEW_ENVIRONMENT_YIELD_TYPE;

interface PreviewToggles {
  sun: boolean;
  environment: boolean;
}

/**
 * Which previews to mount. Mirrors `_node_added`: by node type only, so a hidden
 * `DirectionalLight3D` with zero energy still takes the preview sun away.
 */
export function previewYield(sceneNodeTypes: Iterable<string>, toggles: PreviewToggles): PreviewToggles {
  let hasDirectionalLight = false;
  let hasWorldEnvironment = false;

  for (const type of sceneNodeTypes) {
    if (type === PREVIEW_ENVIRONMENT_YIELD_TYPE) hasWorldEnvironment = true;
    else if (type === PREVIEW_SUN_YIELD_TYPE) hasDirectionalLight = true;
  }

  return {
    sun: toggles.sun && !hasDirectionalLight,
    environment: toggles.environment && !hasWorldEnvironment,
  };
}

/**
 * The direction the preview sun's light travels: Godot's euler applied to a
 * light's local -Z, in the YXZ order `Basis::from_euler` defaults to, which three
 * spells the same way.
 */
export function previewSunDirection(): THREE.Vector3 {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(PREVIEW_SUN_ALTITUDE_DEG),
    THREE.MathUtils.degToRad(PREVIEW_SUN_AZIMUTH_DEG),
    0,
    'YXZ'
  );
  return new THREE.Vector3(0, 0, -1).applyEuler(euler).normalize();
}

/** Godot's `Color::get_luminance()`, with Rec. 709 coefficients. */
function luminance({ r, g, b }: Rgba): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The preview horizon is not the midpoint of sky and ground: Godot takes that
 * midpoint, computes its luminance scaled by 3.333, and pushes the colour
 * halfway towards that grey. The push is what keeps the horizon bright rather
 * than muddy.
 */
function previewHorizonColor(): Rgba {
  const midpoint = lerpColor(PREVIEW_SKY_TOP, PREVIEW_GROUND_BOTTOM, 0.5);
  const lum = luminance(midpoint) * 3.333;
  return lerpColor(midpoint, { r: lum, g: lum, b: lum, a: 1 }, 0.5);
}

/**
 * Godot's preview environment, through the same decode and build pipeline as an
 * authored `WorldEnvironment`, so the two cannot diverge. Its glow becomes a
 * bloom pass in `ToneMapLayer`.
 */
export function previewEnvironment(): { settings: EnvironmentSettings; sky: Sky } {
  const settings = createEnvironmentSettings(
    decodeEnvironment({
      background_mode: String(2), // BG_SKY
      // TONE_MAPPER_FILMIC: the preview departs from an authored Environment's
      // LINEAR default.
      tonemap_mode: String(2),
      // The editor preview enables glow; emissive materials bloom because of it.
      glow_enabled: 'true',
    }),
    // BG_SKY draws no clear colour.
    DEFAULT_CLEAR_COLOR
  );

  const horizon = previewHorizonColor();
  const material = decodeSkyMaterial('ProceduralSkyMaterial', {}) as ProceduralSkyProperties;

  return {
    settings,
    // The editor's Sky keeps every default but its material (`node_3d_editor_plugin.cpp:10394`).
    sky: decodeSky(
      {},
      {
        ...material,
        sky_top_color: PREVIEW_SKY_TOP,
        sky_horizon_color: horizon,
        ground_bottom_color: PREVIEW_GROUND_BOTTOM,
        ground_horizon_color: horizon,
      }
    ),
  };
}
