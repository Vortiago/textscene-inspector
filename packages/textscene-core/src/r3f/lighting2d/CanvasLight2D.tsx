/**
 * `CanvasLight2D` declares a 2D light on its canvas and draws its quads into the light pass. A light
 * node hands it the light's term and imports nothing else of `r3f/lighting2d/`.
 */

import type * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import type { Vector2 } from '../../godot/math/vector';
import type { Light2DBlendMode, Light2DShadowFilter } from '../../godot/scene/light2d';
import type { EnumValue } from '../../godot/classdb/enumNames';
import { PointLightQuads } from './PointLightQuads';
import { DirectionalLightQuads } from './DirectionalLightQuads';

/** `Light2D`'s shadow properties. */
export interface LightShadowTerm {
  enabled: boolean;
  /** `shadow_item_cull_mask`: the items the shadow lands on. */
  itemCullMask: number;
  color: Rgba;
  filter: EnumValue<typeof Light2DShadowFilter>;
  filterSmooth: number;
}

interface LightTermBase {
  color: Rgba;
  energy: number;
  blendMode: EnumValue<typeof Light2DBlendMode>;
  /** `Light2D.height`, which a normal-mapped item shades the light from. */
  height: number;
  shadow: LightShadowTerm;
}

/** A PointLight2D's term: its light texture placed on the canvas, and the items its range reaches. */
export interface PointLightTerm extends LightTermBase {
  kind: 'point';
  cookie: THREE.Texture;
  textureScale: number;
  offset: Vector2;
  /** `range_item_cull_mask`. */
  itemCullMask: number;
  zMin: number;
  zMax: number;
  layerMin: number;
  layerMax: number;
}

/** A DirectionalLight2D's term: one colour over its canvas layers. */
export interface DirectionalLightTerm extends LightTermBase {
  kind: 'directional';
  /** `max_distance`: how far its shadow reaches past the view. */
  maxDistance: number;
  layerMin: number;
  layerMax: number;
}

/** A union, as a light texture, its scale and offset mean nothing to a directional light. */
export type LightTerm = PointLightTerm | DirectionalLightTerm;

/**
 * Declares the light while mounted, and withdraws it on unmount. A DirectionalLight2D stays
 * undeclared while Godot leaves it off its directional list: hidden, or past the eighth on its
 * canvas. It renders inside the light node's `CanvasItem2D` body, so it takes the node's transform.
 */
export function CanvasLight2D({ term }: { term: LightTerm }) {
  return term.kind === 'point' ? <PointLightQuads term={term} /> : <DirectionalLightQuads term={term} />;
}
