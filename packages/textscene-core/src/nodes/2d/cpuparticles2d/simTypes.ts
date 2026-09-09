/**
 * The shapes the frozen-pose simulation passes between its steps: what goes in,
 * what a live particle is while it runs, and what comes out.
 *
 * A leaf so the per-step modules (`particleRestart`, `particleAdvance`,
 * `particleAppearance`, `particlesProcess`) can share them without importing
 * `simulate.ts`, which imports them in turn.
 *
 * Part of the CPUParticles2D port; the derivation notice is in `simulate.ts`.
 */

import type { Color, Vector2 } from '../../base/node2d/types';
import type { Curve } from '../../../resources/curves/curve/types';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import type { GodotRandomPCG } from './godotRng';
import type { CPUParticles2DProperties } from './types';
import type { Affine2D } from './affine2d';

/** Godot's `Curve` slots, indexed by `CPUParticles2DParam`; null where unset. */
export type ParticleCurves = ReadonlyArray<Curve | null>;

export interface ParticleSimInput {
  props: CPUParticles2DProperties;
  curves: ParticleCurves;
  colorRamp: Gradient | null;
  colorInitialRamp: Gradient | null;
  /**
   * The emitter's world transform in Godot 2D pixel space. Used only when
   * `local_coords` is false, where Godot spawns in global space and draws the
   * canvas item with an identity transform; we render inside the node's group,
   * so the pose is mapped back through this transform's inverse.
   */
  emissionTransform: Affine2D;
}

/** One particle as the renderer needs it: where its quad goes, and its tint. */
export interface RenderedParticle {
  /** Item-local `Transform2D` mapping the texture quad's local corners. */
  transform: Affine2D;
  /** Godot's `p.color` — sRGB, alpha included, curve/ramp/hue already applied. */
  color: Color;
  /**
   * Godot's `p.custom[2]`, reaching the canvas shader as `INSTANCE_CUSTOM.z`:
   * `anim_offset + age × anim_speed`. A `CanvasItemMaterial` with
   * `particles_animation` turns it into a flipbook cell index.
   */
  anim: number;
  /** `p.time`, in seconds. The `draw_order = Lifetime` sort key. */
  age: number;
  /** The particle's index in the emitter, i.e. its `draw_order = Index` order. */
  index: number;
}

/** Godot's private `Particle` struct, only the fields the process loop reads. */
export interface Particle {
  transform: Affine2D;
  color: Color;
  custom: [number, number, number, number];
  rotation: number;
  velocity: Vector2;
  active: boolean;
  angleRand: number;
  scaleRand: number;
  hueRotRand: number;
  animOffsetRand: number;
  startColorRand: Color;
  time: number;
  lifetime: number;
  baseColor: Color;
  seed: number;
}

export interface SimState {
  time: number;
  cycle: number;
  emitting: boolean;
  particles: Particle[];
  lifetime: number;
  seed: number;
  rng: GodotRandomPCG;
  emissionXform: Affine2D;
}
