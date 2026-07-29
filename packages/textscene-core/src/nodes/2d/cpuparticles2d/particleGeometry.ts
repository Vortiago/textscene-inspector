/**
 * Turn a frozen particle pose into ONE `THREE.BufferGeometry`.
 *
 * Godot draws the emitter as a MultiMesh of identical textured quads whose
 * per-instance data is a `Transform2D` plus an RGBA colour. three has no
 * per-instance ALPHA (`InstancedMesh.instanceColor` is RGB), and the alpha is
 * exactly what `color_ramp` animates, so the pose becomes one merged geometry
 * with a four-component vertex-colour attribute instead. That also gives the
 * draw order for free: within a single geometry, triangles blend in index
 * order, which is what `draw_order` decides.
 *
 * The quad Godot builds is `texture.get_size()` across, centred on the origin
 * (`cpu_particles_2d.cpp:186-199`), so one pixel is one world unit like every
 * other 2D slice. Positions are computed in Godot's +Y-down space and then
 * Y-negated for the conjugated Node2D group frame (see `node2dTransform`), and
 * the V coordinate is mirrored because textures upload bottom-up.
 *
 * A `CanvasItemMaterial` with `particles_animation` makes the texture a
 * FLIPBOOK rather than one image, and that is a shrink of the quad as much as a
 * window on the UVs — Godot's generated vertex shader divides `VERTEX.xy` by
 * the frame counts before the per-particle transform is applied. Both happen
 * here, per particle, because each one is on its own cell.
 */

import * as THREE from 'three';
import { godotColorToLinear } from '../../../r3f/godotColor';
import type { RenderedParticle } from './simulate';

/**
 * Quad-local corners in Godot 2D space, paired with their GODOT UVs (origin
 * top-left, +V down — `_update_mesh_texture`'s own winding).
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
 * Build the merged quad geometry, or null for an empty pose (a caller with no
 * particles must render no mesh at all rather than an empty draw call).
 *
 * `width`/`height` are the texture's pixel size; Godot falls back to 1×1 when
 * the emitter has no texture, and so does the caller.
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
      positions[v + 1] = 0 - gy;
      positions[v + 2] = 0;

      const t = (i * 4 + c) * 2;
      uvs[t] = corner.u / hFrames + uOffset;
      // Godot's V runs top-down; three's texture upload is bottom-up.
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
  // itemSize 4 is what makes three define USE_COLOR_ALPHA, i.e. what carries
  // the per-particle alpha a colour ramp fades out with.
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
  // A non-finite anim would poison every UV in the quad; the first cell is the
  // one reading a broken value should fall back to.
  if (!Number.isFinite(frame)) return 0;
  if (!loop) return Math.min(totalFrames - 1, Math.max(0, frame));
  // GLSL `mod` follows the sign of the divisor, so a negative anim wraps up.
  return ((frame % totalFrames) + totalFrames) % totalFrames;
}
