import * as THREE from 'three';
import * as TSL from 'three/tsl';
import type { Node, TextureNode, UniformNode } from 'three/webgpu';
import { readAsStored } from '../language/readAsStored.js';
import { readStoredDepth } from '../language/storedDepthReads.js';
import type { Float, Vec2 } from '../tslTypes.js';

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

/** The colour of one program's atlas node, and whether its raw reads take the GPU's filter. */
interface ColourRead {
  readonly colour: TextureNode;
  readonly isFiltered: UniformNode<boolean>;
}

/** Written only by `directionalShadowAtlasNode`, once for each program's atlas node. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const colourReads = new WeakMap<TextureNode, ColourRead>();

function storedDepthAt(colour: TextureNode, texel: Node): Float {
  const load = colour.load(texel as never);
  // A texel needs no uv transform, which three's load would apply as a matrix product to each texel.
  load.updateMatrix = false;
  const bytes = TSL.floor(load.rg.mul(255).add(0.5));
  return TSL.dot(bytes, DEPTH_BYTES).div(DEPTH_STEPS) as unknown as Float;
}

/** One filtered sample, as Godot takes: a GPU that filters in floating point mixes the bytes exactly. */
function sampledStoredDepth(colour: TextureNode, uv: Vec2): Float {
  const sample = colour.sample(uv as never).level(TSL.float(0) as never) as unknown as TextureNode;
  sample.updateMatrix = false;
  return TSL.dot(sample.rg.mul(255), DEPTH_BYTES).div(DEPTH_STEPS) as unknown as Float;
}

/** Filtered by hand over four texels: a GPU that filters 8-bit channels at 8 bits loses the low byte. */
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
  const colour = TSL.texture(NO_COLOUR) as unknown as TextureNode;
  readAsStored(colour);
  const isFiltered = TSL.uniform(false) as unknown as UniformNode<boolean>;
  colourReads.set(atlas, { colour, isFiltered });
  readStoredDepth(atlas, {
    read: (uv) => {
      const at = uv as unknown as Vec2;
      const stored = TSL.select(
        isFiltered as never,
        sampledStoredDepth(colour, at),
        filteredStoredDepth(colour, at)
      );
      return TSL.float(1).sub(stored as never) as unknown as Node;
    },
    storedReference: (_uv, reference) => TSL.float(1).sub(reference as never) as unknown as Node,
  });
  return atlas;
}

/** Binds the colour of `atlas`'s raw reads; `isFiltered` sends each read to one filtered sample. */
export function bindDirectionalShadowColour(
  atlas: TextureNode,
  colour: THREE.Texture | undefined,
  isFiltered: boolean
): void {
  const read = colourReads.get(atlas);
  if (!read) return;
  read.colour.value = colour ?? NO_COLOUR;
  read.isFiltered.value = colour !== undefined && isFiltered;
}
