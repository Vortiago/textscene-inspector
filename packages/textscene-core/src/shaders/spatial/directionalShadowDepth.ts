import * as THREE from 'three';
import * as TSL from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
import { readAsStored } from '../language/readAsStored.js';
import { readStoredDepth } from '../language/storedDepthReads.js';
import {
  DIRECTIONAL_SHADOW_MAX_SPLITS,
  MAX_DIRECTIONAL_LIGHTS,
} from '../../godot/rendering/lights/directionalShadow.js';
import { atlasCellsOf, type DirectionalShadowAtlasShare } from './directionalShadowAtlasCells.js';
import type { Float, Vec2 } from '../tslTypes.js';

/** Godot's depth of a caster nearer the light than the split box (`scene_forward_clustered.glsl:679`). */
const PANCAKE_DEPTH = 0.9999;

/** The atlas's colour holds each texel's stored depth as two bytes (`atlasDepthMaterials.ts`). */
const DEPTH_BYTES = TSL.vec2(256, 1);
const DEPTH_STEPS = 65535;

/** What a read binds while no atlas is drawn. A light with no shadow reads nothing. */
const NO_COLOUR = new THREE.DataTexture(new Uint8Array(4), 1, 1);
NO_COLOUR.needsUpdate = true;

/** The colour a read binds while no atlas is drawn, which the previewer releases on unmount. */
export function unboundDirectionalShadowColour(): THREE.Texture {
  return NO_COLOUR;
}

/** The terms of one program's reads of the atlas, refilled by each draw. */
interface AtlasLayout {
  readonly colour: TextureNode;
  /** Columns and rows of the grid the lights' rectangles cut the atlas into (`light_storage.cpp:2577`). */
  readonly grid: Vec2 & { value: THREE.Vector2 };
  readonly splitCounts: FloatArray;
  readonly depthScales: FloatArray;
}

/** A TSL `uniformArray` of floats, which three's types do not give. */
interface FloatArray {
  readonly array: number[];
  element(index: Node): Float;
}

/** Written only by `directionalShadowAtlasNode`, once for each program's atlas node. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const layouts = new WeakMap<TextureNode, AtlasLayout>();

function newLayout(): AtlasLayout {
  const colour = TSL.texture(NO_COLOUR) as unknown as TextureNode;
  readAsStored(colour);
  return {
    colour,
    grid: TSL.uniform(new THREE.Vector2(1, 1)) as unknown as AtlasLayout['grid'],
    splitCounts: TSL.uniformArray(new Array<number>(MAX_DIRECTIONAL_LIGHTS).fill(0), 'float') as never,
    depthScales: TSL.uniformArray(
      new Array<number>(MAX_DIRECTIONAL_LIGHTS * DIRECTIONAL_SHADOW_MAX_SPLITS).fill(1),
      'float'
    ) as never,
  };
}

/** `directionalShadowSplitAtlasRect`: four splits take the quadrants, two the halves of the height. */
function splitInShare(local: Vec2, splitCount: Float): Float {
  const half = TSL.min(TSL.floor(local.mul(2)), TSL.vec2(1)) as unknown as Vec2;
  return TSL.select(
    splitCount.greaterThan(2.5),
    half.x.add(half.y.mul(2)),
    TSL.select(splitCount.greaterThan(1.5), half.y, TSL.float(0))
  ) as unknown as Float;
}

/** The depth scale of the split whose rectangle holds `uv`. */
function depthScaleAt({ grid, splitCounts, depthScales }: AtlasLayout, uv: Vec2): Float {
  const position = TSL.clamp(uv, 0, 1).mul(grid) as unknown as Vec2;
  const cell = TSL.min(TSL.floor(position), grid.sub(1)) as unknown as Vec2;
  const share = TSL.int(cell.y.mul(grid.x).add(cell.x));
  const splitCount = splitCounts.element(share);
  const split = splitInShare(position.sub(cell) as unknown as Vec2, splitCount);
  const index = share.mul(DIRECTIONAL_SHADOW_MAX_SPLITS).add(TSL.int(split));
  return depthScales.element(index);
}

function storedDepthAt(colour: TextureNode, texel: Node): Float {
  const bytes = TSL.floor(
    colour
      .load(texel as never)
      .rg.mul(255)
      .add(0.5)
  );
  return TSL.dot(bytes, DEPTH_BYTES).div(DEPTH_STEPS) as unknown as Float;
}

/** The stored depth, filtered over four texels as Godot's linear sampler filters them. */
function filteredStoredDepth(colour: TextureNode, uv: Vec2): Float {
  const size = TSL.vec2(colour.size(TSL.int(0)) as never) as unknown as Vec2;
  const last = TSL.ivec2(size.sub(1) as never);
  const position = TSL.clamp(uv, 0, 1).mul(size).sub(0.5) as unknown as Vec2;
  const corner = TSL.ivec2(TSL.floor(position) as never);
  const weight = TSL.fract(position) as unknown as Vec2;
  const at = (x: number, y: number) =>
    storedDepthAt(
      colour,
      TSL.clamp(corner.add(TSL.ivec2(x, y)) as never, TSL.ivec2(0) as never, last as never) as unknown as Node
    );
  const bottom = TSL.mix(at(0, 0), at(1, 0), weight.x);
  const top = TSL.mix(at(0, 1), at(1, 1), weight.x);
  return TSL.mix(bottom, top, weight.y) as unknown as Float;
}

/** A node for the template's directional atlas, whose reads take Godot's depth. */
export function directionalShadowAtlasNode(): TextureNode {
  // Every read goes through the stored depth, so the node's own texture is never sampled.
  const atlas = TSL.texture(NO_COLOUR) as unknown as TextureNode;
  const layout = newLayout();
  layouts.set(atlas, layout);
  readStoredDepth(atlas, {
    read: (uv) => {
      const stored = filteredStoredDepth(layout.colour, uv as unknown as Vec2);
      const godot = depthScaleAt(layout, uv as unknown as Vec2).mul(TSL.float(1).sub(stored));
      return TSL.min(godot, PANCAKE_DEPTH) as unknown as Node;
    },
    storedReference: (uv, reference) =>
      TSL.float(1).sub(
        TSL.div(reference as never, depthScaleAt(layout, uv as unknown as Vec2))
      ) as unknown as Node,
  });
  return atlas;
}

/** Fills the layout of `atlas` from the shares of this draw's lights, and binds `colour`. */
export function bindDirectionalShadowLayout(
  atlas: TextureNode,
  colour: THREE.Texture | undefined,
  shares: readonly DirectionalShadowAtlasShare[]
): void {
  const layout = layouts.get(atlas);
  if (!layout) return;
  const cells = atlasCellsOf(shares);
  layout.colour.value = colour ?? NO_COLOUR;
  layout.grid.value.set(cells.columns, cells.rows);
  cells.splitCounts.forEach((count, cell) => (layout.splitCounts.array[cell] = count));
  cells.depthScales.forEach((scale, lane) => (layout.depthScales.array[lane] = scale));
}
