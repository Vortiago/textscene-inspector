/**
 * Turns a frozen particle pose into one `THREE.BufferGeometry`. Godot draws a
 * MultiMesh with per-instance RGBA, but three has no per-instance alpha, which
 * `color_ramp` animates. One merged geometry with RGBA vertex colours also blends
 * in index order, which is what `draw_order` decides.
 */

import * as THREE from 'three';
import { godotColorToLinear } from '../../../r3f/godotColor';
import type { RenderedParticle } from './simulate';

/**
 * Quad-local corners in Godot 2D space, paired with their Godot UVs: origin
 * top-left, +V down, `_update_mesh_texture`'s own winding.
 */
const CORNERS: ReadonlyArray<{ cx: number; cy: number; u: number; v: number }> = [
  { cx: -0.5, cy: -0.5, u: 0, v: 0 },
  { cx: 0.5, cy: -0.5, u: 1, v: 0 },
  { cx: 0.5, cy: 0.5, u: 1, v: 1 },
  { cx: -0.5, cy: 0.5, u: 0, v: 1 },
];

/** `CanvasItemMaterial`'s particle flipbook, when the emitter's material has one. */
export interface ParticleFlipbook {
  hFrames: number;
  vFrames: number;
  /** `particles_anim_loop`: wrap past the last cell instead of holding on it. */
  loop: boolean;
}

/**
 * The merged quad geometry, or null for an empty pose, which renders no mesh.
 * `width`/`height` are the texture's pixel size, 1×1 with no texture as in Godot.
 * The quad is that size, centred on the origin (`cpu_particles_2d.cpp:186-199`),
 * so one pixel is one world unit.
 */
export function buildParticleGeometry(
  pose: readonly RenderedParticle[],
  width: number,
  height: number,
  flipbook: ParticleFlipbook | null = null
): THREE.BufferGeometry | null {
  if (pose.length === 0) return null;

  const hFrames = flipbook ? Math.max(1, Math.floor(flipbook.hFrames)) : 1;
  const vFrames = flipbook ? Math.max(1, Math.floor(flipbook.vFrames)) : 1;
  const totalFrames = hFrames * vFrames;
  // A flipbook shrinks the quad as well as windowing the UVs: Godot's vertex
  // shader divides `VERTEX.xy` by the frame counts before the particle transform.
  const cellWidth = width / hFrames;
  const cellHeight = height / vFrames;

  const count = pose.length;
  const positions = new Float32Array(count * 4 * 3);
  const uvs = new Float32Array(count * 4 * 2);
  const colors = new Float32Array(count * 4 * 4);
  const indices = new Uint32Array(count * 6);

  for (let i = 0; i < count; i++) {
    const { transform, color, anim } = pose[i]!;
    const linear = godotColorToLinear(color);
    const frame = flipbookFrame(anim, totalFrames, flipbook?.loop ?? false);
    const uOffset = (frame % hFrames) / hFrames;
    const vOffset = Math.floor((frame + 0.5) / hFrames) / vFrames;

    for (let c = 0; c < 4; c++) {
      const corner = CORNERS[c]!;
      const cx = corner.cx * cellWidth;
      const cy = corner.cy * cellHeight;
      // Transform2D: columns[0] * x + columns[1] * y + columns[2].
      const gx = transform.ax * cx + transform.bx * cy + transform.ox;
      const gy = transform.ay * cx + transform.by * cy + transform.oy;

      const v = (i * 4 + c) * 3;
      positions[v] = gx;
      // Godot's +Y-down space, Y-negated for the conjugated Node2D group frame.
      positions[v + 1] = 0 - gy;
      positions[v + 2] = 0;

      const t = (i * 4 + c) * 2;
      uvs[t] = corner.u / hFrames + uOffset;
      // Godot's V runs top-down. Three's texture upload is bottom-up.
      uvs[t + 1] = 1 - (corner.v / vFrames + vOffset);

      const k = (i * 4 + c) * 4;
      colors[k] = linear.r;
      colors[k + 1] = linear.g;
      colors[k + 2] = linear.b;
      colors[k + 3] = color.a;
    }

    const base = i * 4;
    const t = i * 6;
    indices[t] = base;
    indices[t + 1] = base + 1;
    indices[t + 2] = base + 2;
    indices[t + 3] = base;
    indices[t + 4] = base + 2;
    indices[t + 5] = base + 3;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  // itemSize 4 makes three define USE_COLOR_ALPHA, which carries the per-particle
  // alpha a colour ramp fades out with.
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * The flipbook cell a particle's `custom[2]` selects, mirroring the vertex
 * shader `CanvasItemMaterial` generates for `particles_animation`:
 *
 *   particle_frame = floor(INSTANCE_CUSTOM.z * particle_total_frames)
 *   !loop ? clamp(frame, 0, total - 1) : mod(frame, total)
 */
function flipbookFrame(anim: number, totalFrames: number, loop: boolean): number {
  const frame = Math.floor(anim * totalFrames);
  // A non-finite anim would poison every UV in the quad. The first cell is the
  // one reading a broken value should fall back to.
  if (!Number.isFinite(frame)) return 0;
  if (!loop) return Math.min(totalFrames - 1, Math.max(0, frame));
  // GLSL `mod` follows the sign of the divisor, so a negative anim wraps up.
  return ((frame % totalFrames) + totalFrames) % totalFrames;
}
