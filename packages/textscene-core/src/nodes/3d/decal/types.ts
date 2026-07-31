/**
 * Decal types and interfaces.
 *
 * Mirrors Godot's Decal — a VisualInstance3D that projects `texture_albedo`
 * (and optional ORM/normal/emission maps) down the node's local -Y axis onto
 * surfaces inside an axis-aligned box of dimensions `size`, centred on the
 * node origin. The v1 renderer honours `texture_albedo`, `size`, `modulate`,
 * and `albedo_mix`; the remaining fields are parsed so the Inspector and
 * linter see the full property surface.
 */

import type { Node3DProperties } from '../../base/node3d/types';
import type { Color } from '../../../utils/colorParser';
import type { Vector3 } from '../../../parser/vectors';

export interface DecalProperties extends Node3DProperties {
  /** Albedo texture projected onto surfaces (ExtResource/SubResource ref). */
  texture_albedo?: string;

  /** Optional normal-map texture reference (parsed, not rendered in v1). */
  texture_normal?: string;

  /** Optional ORM (occlusion/roughness/metallic) texture reference. */
  texture_orm?: string;

  /** Optional emission texture reference. */
  texture_emission?: string;

  /** Full size of the projection box in local units (default: 2, 2, 2). */
  size: Vector3;

  /** Color tint multiplied into the projected albedo (default: white). */
  modulate: Color;

  /** How strongly the albedo replaces the surface beneath (0..1, default 1). */
  albedo_mix: number;

  /** Multiplier applied to the emission texture (default: 1). */
  emission_energy: number;

  /** Fade based on surface normal vs projection axis (0..1, default 0). */
  normal_fade: number;

  /** Fade at the top of the projection box (0..1, default 0.3). */
  upper_fade: number;

  /** Fade at the bottom of the projection box (0..1, default 0.3). */
  lower_fade: number;

  /** Render-layer bitmask deciding which surfaces receive the decal. */
  cull_mask: number;

  /** Whether the decal fades out with camera distance (default: false). */
  distance_fade_enabled: boolean;

  /** Camera distance at which the fade starts (default: 40). */
  distance_fade_begin: number;

  /** Distance over which the fade completes; past it the decal is culled (default: 10). */
  distance_fade_length: number;
}
