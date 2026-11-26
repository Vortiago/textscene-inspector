import * as THREE from 'three';
import * as TSL from 'three/tsl';
import type { Node, TextureNode } from 'three/webgpu';
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

/** Written only by `directionalShadowAtlasNode`, once for each program's atlas node. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const colours = new WeakMap<TextureNode, TextureNode>();

function storedDepthAt(colour: TextureNode, texel: Node): Float {
  const bytes = TSL.floor(
    colour
      .load(texel as never)
      .rg.mul(255)
      .add(0.5)
  );
  return TSL.dot(bytes, DEPTH_BYTES).div(DEPTH_STEPS) as unknown as Float;
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
  colours.set(atlas, colour);
  readStoredDepth(atlas, {
    read: (uv) => TSL.float(1).sub(filteredStoredDepth(colour, uv as unknown as Vec2)) as unknown as Node,
    storedReference: (_uv, reference) => TSL.float(1).sub(reference as never) as unknown as Node,
  });
  return atlas;
}

/** Binds the colour that the raw reads of `atlas` take their stored depth from. */
export function bindDirectionalShadowColour(atlas: TextureNode, colour: THREE.Texture | undefined): void {
  const node = colours.get(atlas);
  if (node) node.value = colour ?? NO_COLOUR;
}
