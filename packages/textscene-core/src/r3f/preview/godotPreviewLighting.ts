/**
 * Godot's editor preview lighting (ADR-0025).
 *
 * The previewer is an editor, so it takes the editor's semantics: a scene that
 * supplies no sun gets Godot's preview sun, a scene that supplies no
 * environment gets Godot's preview environment, and each yields independently
 * the moment the scene provides its own. At RUNTIME Godot adds neither, which
 * is why an unlit scene renders black in the game and lit in the editor.
 *
 * Values transcribed from `Node3DEditor::_load_default_preview_settings` and
 * `_preview_settings_changed`; the yield rule from `_node_added`.
 */

import * as THREE from 'three';
import type { TscnNode } from '../../parser/types';
import type { Color } from '../../utils/colorParser';
import { createEnvironmentSettings } from '../../resources/environment/build';
import type { EnvironmentSettings } from '../../resources/environment/types';
import { decodeSkyMaterial } from '../../resources/sky/decode';
import type { ProceduralSkyProperties, SkyProperties } from '../../resources/sky/types';
import { decodeEnvironment } from '../../resources/environment/decode';

/** The node types the editor counts, one independent counter each. */
export const PREVIEW_SUN_YIELD_TYPE = 'DirectionalLight3D';
export const PREVIEW_ENVIRONMENT_YIELD_TYPE = 'WorldEnvironment';

/**
 * "These default rotations place the preview sun at an angular altitude of 60
 * degrees (must be negative) and an azimuth of 30 degrees clockwise from north
 * (or 150 CCW from south), from north east, facing south west."
 */
export const PREVIEW_SUN_ALTITUDE_DEG = -60;
export const PREVIEW_SUN_AZIMUTH_DEG = 150;

/** Godot's preview sun is white at energy 1.0 with shadows enabled. */
export const PREVIEW_SUN_COLOR = 0xffffff;
export const PREVIEW_SUN_ENERGY = 1;
export const PREVIEW_SUN_SHADOW_MAX_DISTANCE = 100;

const PREVIEW_SKY_TOP: Color = { r: 0.385, g: 0.454, b: 0.55, a: 1 };
const PREVIEW_GROUND_BOTTOM: Color = { r: 0.2, g: 0.169, b: 0.133, a: 1 };

/**
 * The nodes Godot's two counters watch. A stable module-level predicate: the
 * live-tree hook memoises on it.
 */
export const YIELDS_A_PREVIEW = (node: TscnNode): boolean =>
  node.type === PREVIEW_SUN_YIELD_TYPE || node.type === PREVIEW_ENVIRONMENT_YIELD_TYPE;

export interface PreviewToggles {
  sun: boolean;
  environment: boolean;
}

/**
 * Which previews to mount. Mirrors `_node_added`: by node TYPE, with no regard
 * for whether the node is visible or emits anything — a `DirectionalLight3D`
 * with `visible = false` and zero energy still takes the preview sun away, in
 * Godot and here.
 */
export function previewYield(
  sceneNodeTypes: Iterable<string>,
  toggles: PreviewToggles
): PreviewToggles {
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
 * The direction the preview sun's light TRAVELS — Godot's authored euler
 * applied to a light's local -Z, in the YXZ order `Basis::from_euler` defaults
 * to (and which three spells the same way).
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

/** Godot's `Color::get_luminance()` — Rec. 709 coefficients. */
function luminance({ r, g, b }: Color): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function lerp(a: Color, b: Color, t: number): Color {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: 1,
  };
}

/**
 * The preview horizon is not the midpoint of sky and ground: Godot takes that
 * midpoint, computes its luminance scaled by 3.333, and pushes the colour
 * halfway towards that grey. The push is what keeps the horizon bright rather
 * than muddy.
 */
function previewHorizonColor(): Color {
  const midpoint = lerp(PREVIEW_SKY_TOP, PREVIEW_GROUND_BOTTOM, 0.5);
  const lum = luminance(midpoint) * 3.333;
  return lerp(midpoint, { r: lum, g: lum, b: lum, a: 1 }, 0.5);
}

/**
 * Godot's preview environment, built through the same decode→build pipeline an
 * authored `WorldEnvironment` goes through, so the two cannot diverge in how
 * they are applied.
 *
 * The preview also enables glow (matching `_load_default_preview_settings`),
 * which the render layer turns into a bloom compositor pass (`GlowLayer`) so
 * emissive materials bloom as they do in Godot's editor.
 */
export function previewEnvironment(): { settings: EnvironmentSettings; sky: SkyProperties } {
  const settings = createEnvironmentSettings(
    decodeEnvironment({
      background_mode: String(2), // BG_SKY
      // TONE_MAPPER_FILMIC — the preview's deliberate departure from the
      // LINEAR default an authored Environment starts with.
      tonemap_mode: String(2),
      // The editor preview enables glow; emissive materials bloom because of it.
      glow_enabled: 'true',
    })
  );

  const horizon = previewHorizonColor();
  const sky = decodeSkyMaterial('ProceduralSkyMaterial', {}) as ProceduralSkyProperties;

  return {
    settings,
    sky: {
      ...sky,
      sky_top_color: PREVIEW_SKY_TOP,
      sky_horizon_color: horizon,
      ground_bottom_color: PREVIEW_GROUND_BOTTOM,
      ground_horizon_color: horizon,
    },
  };
}
