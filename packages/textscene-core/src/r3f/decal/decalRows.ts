/**
 * The decals a scene draws with, packed as the texels each lit fragment fetches: Godot's `DecalData`
 * (`texture_storage.cpp:3316-3486`), one row per decal laid out as `decalRowLayout.ts` says, in the
 * view space of the camera that renders them.
 */

import * as THREE from 'three';
import { basisOrthonormalized } from '../../godot/math/basis.js';
import { distanceFade } from '../../godot/rendering/distanceFade.js';
import { sRGBToLinearRGB } from '../../utils/colorSpace.js';
import type { AtlasRect } from '../../resources/textures/atlastexture/types.js';
import type { DecalProperties } from '../../nodes/3d/decal/types.js';
import { RowBuffer } from '../rowTexture/packedRows.js';
import { DECAL_MAPS, DECAL_TEXEL, RECT_TEXEL, type DecalMap } from './decalRowLayout.js';
import { SCENE_ROW_TEXELS } from '../sceneRows/sceneRowTexels.js';

/** What a decal reads of its node. */
export type DecalLook = Pick<
  DecalProperties,
  | 'size'
  | 'modulate'
  | 'albedo_mix'
  | 'emission_energy'
  | 'normal_fade'
  | 'upper_fade'
  | 'lower_fade'
  | 'cull_mask'
  | 'distance_fade_enabled'
  | 'distance_fade_begin'
  | 'distance_fade_length'
  | 'sorting_offset'
>;

/** What the shader reads of one decal. */
export interface DrawnDecal {
  matrixWorld: THREE.Matrix4;
  look: DecalLook;
  /** Where the atlas holds the decal's texture for `map`, null for a map the decal lacks. */
  mapRect(map: DecalMap): AtlasRect | null;
}

/** Godot's `max_decals` (`texture_storage.h:348`): the decals past it draw nothing. */
export const MAX_DECALS = 512;

/** `Decal::set_size` floors each component here (`decal.cpp:33-36`). */
const MIN_SIZE = 0.001;

/** The box `[0, 1]` in x and z and `[-1, 1]` in y, as `uv_xform` maps it (`texture_storage.cpp:3319-3321`). */
const UV_TRANSFORM = new THREE.Matrix4().set(2, 0, 0, -1, 0, 1, 0, 0, 0, 0, 2, -1, 0, 0, 0, 1);

/** Scratch for one `decalTexels`, overwritten by each. */
const viewInverse = new THREE.Matrix4();
const toDecal = new THREE.Matrix4();
const boxScale = new THREE.Matrix4();
const decalOrigin = new THREE.Vector3();
const cameraOrigin = new THREE.Vector3();
const normal = new THREE.Vector3();
/** The atlas rectangle of each map of the decal being packed, set by `readRects`. */
const rects: Record<DecalMap, AtlasRect | null> = { albedo: null, normal: null, orm: null, emission: null };

/**
 * The rows of the drawn decals, rewritten in place by each `pack`. The mask goes in two 16-bit
 * halves, as a float holds 24 bits exactly.
 */
export class DecalRows extends RowBuffer {
  /** The decals the distance fade keeps, with their distance and sort key, each by one index. Cleared by `pack`. */
  private readonly candidates: DrawnDecal[] = [];
  private readonly distances: number[] = [];
  private readonly depths: number[] = [];
  /** The candidates' indices, sorted by depth. Indices, so a pack allocates no entry for each decal. */
  private readonly order: number[] = [];
  private readonly byDepth = (a: number, b: number): number => this.depths[a]! - this.depths[b]!;

  constructor() {
    super(SCENE_ROW_TEXELS * 4);
  }

  /**
   * Packs the first `MAX_DECALS` of `decals` that the distance fade keeps, for a render from
   * `cameraWorld`, nearest first. They arrive in tree order, which a decal at one distance keeps, as
   * `Array.prototype.sort` is stable. Answers whether any row changed.
   */
  pack(decals: readonly DrawnDecal[], cameraWorld: THREE.Matrix4): boolean {
    this.begin();
    viewInverse.copy(cameraWorld).invert();
    cameraOrigin.setFromMatrixPosition(cameraWorld);
    this.candidates.length = this.distances.length = this.depths.length = this.order.length = 0;
    for (const decal of decals) {
      if (this.candidates.length === MAX_DECALS) break;
      const distance = cameraOrigin.distanceTo(decalOrigin.setFromMatrixPosition(decal.matrixWorld));
      if (isPastFade(decal.look, distance) || isFlat(decal)) continue;
      this.order.push(this.candidates.length);
      this.candidates.push(decal);
      this.distances.push(distance);
      this.depths.push(distance - decal.look.sorting_offset);
    }
    this.order.sort(this.byDepth);
    for (const index of this.order) {
      const decal = this.candidates[index]!;
      readRects(decal);
      if (drawsNothing()) continue;
      this.append(decalTexels(decal, fadeAt(decal.look, this.distances[index]!)));
    }
    this.candidates.length = 0;
    return this.finish();
  }
}

/** Whether the node's scale has collapsed the box, whose matrix then has no inverse to project through. */
function isFlat({ matrixWorld }: DrawnDecal): boolean {
  return matrixWorld.determinant() === 0;
}

function readRects(decal: DrawnDecal): void {
  for (const map of DECAL_MAPS) rects[map] = decal.mapRect(map);
}

/**
 * Whether the decal in `rects` has neither an albedo nor an emission texture. Godot counts it among
 * the 512 and leaves its row unwritten (`texture_storage.cpp:3353-3356,3420`), so it takes a place
 * and draws nothing. A normal or an ORM map without an albedo changes nothing
 * (`scene_forward_clustered.glsl:1612,1627`), so it keeps the decal out as well.
 */
function drawsNothing(): boolean {
  return rects.albedo === null && rects.emission === null;
}

/** Whether `distance` lies past the end of the decal's fade, where Godot leaves the decal out. */
function isPastFade(look: DecalLook, distance: number): boolean {
  return look.distance_fade_enabled && distance > look.distance_fade_begin + look.distance_fade_length;
}

/** The factor the decal's distance fade multiplies its alpha by: 1 with the fade off. */
function fadeAt(look: DecalLook, distance: number): number {
  return look.distance_fade_enabled
    ? distanceFade(look.distance_fade_begin, look.distance_fade_length, distance)
    : 1;
}

/** The texels of the decal being packed, overwritten by each `decalTexels`. */
const row = new Float32Array(SCENE_ROW_TEXELS * 4);

function setTexel(texel: number, x: number, y: number, z: number, w: number): void {
  const at = texel * 4;
  row[at] = x;
  row[at + 1] = y;
  row[at + 2] = z;
  row[at + 3] = w;
}

/** Packs `decal` and its `rects` into the row. `fade` is the distance fade, which scales the alpha and the emission energy. */
function decalTexels(decal: DrawnDecal, fade: number): Float32Array {
  const { look } = decal;
  const m = toDecalMatrix(decal).elements;
  for (let i = 0; i < 3; i++) setTexel(DECAL_TEXEL.toDecal + i, m[i]!, m[4 + i]!, m[8 + i]!, m[12 + i]!);
  const up = normal.setFromMatrixColumn(decal.matrixWorld, 1).normalize().transformDirection(viewInverse);
  setTexel(DECAL_TEXEL.up, up.x, up.y, up.z, look.normal_fade);
  for (const map of DECAL_MAPS) setRect(map, rects[map]);
  // Godot's modulate is a linear colour, its alpha untouched (`texture_storage.cpp:3470-3474`).
  const [r, g, b] = sRGBToLinearRGB(look.modulate.r, look.modulate.g, look.modulate.b);
  setTexel(DECAL_TEXEL.modulate, r, g, b, look.modulate.a * fade);
  setTexel(
    DECAL_TEXEL.maskAndFades,
    look.cull_mask & 0xffff,
    look.cull_mask >>> 16,
    look.upper_fade,
    look.lower_fade
  );
  setTexel(DECAL_TEXEL.energyAndMix, look.emission_energy * fade, look.albedo_mix, 0, 0);
  setNormalBasis(decal);
  return row;
}

function setRect(map: DecalMap, rect: AtlasRect | null): void {
  const at = RECT_TEXEL[map];
  if (rect) setTexel(at, rect.x, rect.y, rect.width, rect.height);
  else setTexel(at, 0, 0, 0, 0);
}

/**
 * The columns of the decal's basis, orthonormalised as `Basis::orthonormalized` does, in view space.
 * The scale drops, so the decal's normal map tilts the normal and does not stretch it. Godot computes
 * it only for a decal with a normal map (`texture_storage.cpp:3430-3437`), and the rest keep zero.
 */
function setNormalBasis({ matrixWorld }: DrawnDecal): void {
  if (rects.normal === null) {
    for (let i = 0; i < 3; i++) setTexel(DECAL_TEXEL.normalBasis + i, 0, 0, 0, 0);
    return;
  }
  const e = matrixWorld.elements;
  const basis = basisOrthonormalized([e[0]!, e[4]!, e[8]!, e[1]!, e[5]!, e[9]!, e[2]!, e[6]!, e[10]!]);
  for (let i = 0; i < 3; i++) {
    const column = normal.set(basis[i]!, basis[i + 3]!, basis[i + 6]!).transformDirection(viewInverse);
    setTexel(DECAL_TEXEL.normalBasis + i, column.x, column.y, column.z, 0);
  }
}

/** The view-space point to box coordinate matrix (`texture_storage.cpp:3367-3372`). */
function toDecalMatrix({ matrixWorld, look }: DrawnDecal): THREE.Matrix4 {
  const { x, y, z } = look.size;
  boxScale.makeScale(Math.max(x, MIN_SIZE) / 2, Math.max(y, MIN_SIZE) / 2, Math.max(z, MIN_SIZE) / 2);
  return toDecal.copy(viewInverse).multiply(matrixWorld).multiply(boxScale).multiply(UV_TRANSFORM).invert();
}
