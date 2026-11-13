/**
 * The pipeline inputs of one renderer's shading: what a lit surface reads that the renderer's own
 * passes make. Each is optional. Without one, a surface draws what Godot draws without that
 * feature. The caller sets them before a material first draws, since a texture joins its program
 * when the program builds. A plain value may change between renders.
 */

import type * as THREE from 'three';

/** The shown sky, as Godot's radiance layers (`scene_forward_clustered.glsl:1704-1760`). */
export interface SkyInputs {
  /** The radiance layers, an octmap array. */
  layers: THREE.Texture;
  /**
   * Two vec4: the sky's share of the ambient, the layers' border size, the scale from a squared
   * screen derivative to squared texels, then the energy and 1 while a surface reflects the sky.
   */
  shown: ArrayLike<number>;
  /** World to sky space, column-major. */
  rotation: ArrayLike<number>;
}

/** Godot's directional shadow atlas, which every directional light's shadow draws into. */
export interface SunShadowInputs {
  /** The depth, with a compare function. */
  depth: THREE.DepthTexture;
  /** The raw depth the blocker search reads, as two bytes in red and green. */
  colour: THREE.Texture;
  /**
   * Whether `WebGLRenderer` drew the atlas, so its rows count from the bottom. three's node builder
   * turns the rows of every render target it reads (r187 `TextureNode.js:412-432`), which suits a
   * target its own WebGL 2 backend draws, so the lookup turns them back.
   */
  rowsFromBottom: boolean;
}

export interface PipelineInputs {
  sky?: SkyInputs;
  sunShadow?: SunShadowInputs;
  /**
   * Godot's `sc_use_directional_soft_shadows` for the render: whether any directional light draws
   * a soft shadow, which gives every directional light its size (`scene_forward_clustered.glsl:2615`).
   */
  directionalSoftShadows?: boolean;
  /** `emissive_exposure_normalization` for the render, in its first element. */
  emissionExposure?: ArrayLike<number>;
}
