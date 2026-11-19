import * as THREE from 'three';
import { vec3 } from 'three/tsl';
import { Texture3DNode, type Node, type NodeBuilder, type TextureNode } from 'three/webgpu';

/** A GL pass writes the fog volume's rows bottom first, and Godot's screen UV counts rows from the top. */
class FogVolumeTextureNode extends Texture3DNode {
  /** three's `TextureNode.setupUV`, which its types leave out. */
  setupUV(_builder: NodeBuilder, uvNode: Node): Node {
    const uvw = uvNode as unknown as ReturnType<typeof vec3>;
    return vec3(uvw.x, uvw.y.oneMinus(), uvw.z) as unknown as Node;
  }
}

/** The volume a sky reads until the caller binds one, shared by every sky and never freed. */
const NO_VOLUME = new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1);

/** The template's `volumetric_fog_texture`, which the caller binds to a volume a GL pass wrote. */
export function fogVolumeTextureNode(): TextureNode {
  return new FogVolumeTextureNode(NO_VOLUME);
}
