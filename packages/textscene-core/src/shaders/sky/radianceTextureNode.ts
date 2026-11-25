import type * as THREE from 'three';
import { int } from 'three/tsl';
import { TextureNode, type Node, type NodeBuilder } from 'three/webgpu';

/** The sky's radiance layer the template reads: Godot's mip 0 of layer 0 (`sky.cpp:1330`). */
const READ_LAYER = 0;

/** A bake draws each texel at its Godot row, so the read keeps Godot's coordinate with no row flip. */
class RadianceTextureNode extends TextureNode {
  /** three's `TextureNode.setupUV`, which its types leave out. */
  setupUV(_builder: NodeBuilder, uvNode: Node): Node {
    return uvNode;
  }
}

/** A node over a sky's layer array `layers`, read in Godot's rows. */
export function skyLayersTextureNode(layers: THREE.DataArrayTexture): TextureNode {
  return new RadianceTextureNode(layers);
}

/** The template's `radiance` over the layer array `layers`, read at its first layer. */
export function radianceTextureNode(layers: THREE.DataArrayTexture): TextureNode {
  const node = skyLayersTextureNode(layers);
  // three gives a layer only to `isArrayTexture`, not to a DataArrayTexture (`TextureNode.js:708`).
  node.depthNode = int(READ_LAYER) as unknown as Node;
  return node;
}
