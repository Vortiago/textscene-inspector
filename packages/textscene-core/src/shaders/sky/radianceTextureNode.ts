import * as THREE from 'three';
import { int } from 'three/tsl';
import { TextureNode, type Node, type NodeBuilder } from 'three/webgpu';

/** The sky's radiance layer the template reads: Godot's mip 0 of layer 0 (`sky.cpp:1330`). */
const READ_LAYER = 0;

/** three's `NodeBuilder.getNodeProperties`, which its types leave out. */
interface BuilderProperties {
  getNodeProperties(node: Node): { depthNode?: Node | null };
}

/** A bake draws each texel at its Godot row, so the read keeps Godot's coordinate with no row flip. */
export class RadianceTextureNode extends TextureNode {
  /** three's `TextureNode.setupUV`, which its types leave out. */
  setupUV(_builder: NodeBuilder, uvNode: Node): Node {
    return uvNode;
  }

  // three gives a layer only to `isArrayTexture`, not to a DataArrayTexture (`TextureNode.js:708`).
  override setup(builder: NodeBuilder): Node | null | undefined {
    const output = super.setup(builder);
    const properties = (builder as unknown as BuilderProperties).getNodeProperties(this);
    if (!properties.depthNode && 'isDataArrayTexture' in this.value) {
      properties.depthNode = int(READ_LAYER) as unknown as Node;
    }
    return output;
  }
}

/** The node of the template's `radiance` before a bake binds one: a placeholder texel. */
export const radianceTextureNode = (): TextureNode =>
  new RadianceTextureNode(new THREE.DataTexture(new Uint8Array(4), 1, 1));
