import type { Texture } from 'three';
import {
  CubeTextureNode,
  NodeUpdateType,
  Texture3DNode,
  TextureNode,
  type Node,
  type NodeBuilder,
} from 'three/webgpu';
import { nodeObject } from 'three/tsl';
import type { TextureKind } from '../language/types.js';
import { followSource } from './textureCopies.js';

class FollowingTextureNode extends TextureNode {
  override updateType = NodeUpdateType.RENDER;

  override update(): undefined {
    followSource(this.value);
    return undefined;
  }
}

class FollowingTexture3DNode extends Texture3DNode {
  override updateType = NodeUpdateType.RENDER;

  override update(): undefined {
    followSource(this.value);
    return undefined;
  }
}

/** A cube read with the direction as Vulkan and GL define it: three mirrors x for its own cubes. */
class GodotCubeNode extends CubeTextureNode {
  override updateType = NodeUpdateType.RENDER;

  override update(): undefined {
    followSource(this.value);
    return undefined;
  }

  /** three's `CubeTextureNode.setupUV`, which its types leave out. */
  setupUV(_builder: NodeBuilder, uvNode: Node): Node {
    return uvNode;
  }
}

const NODE_OF_KIND: Readonly<Record<TextureKind, (value: Texture) => TextureNode>> = {
  flat: (value) => new FollowingTextureNode(value),
  layers: (value) => new FollowingTextureNode(value),
  volume: (value) => new FollowingTexture3DNode(value) as unknown as TextureNode,
  cube: (value) => new GodotCubeNode(value as never),
};

/** Unmergeable: three gives one sampler to nodes of one texture, so two unset samplers would stay one. */
export function samplerNodeOf(kind: TextureKind, value: Texture): TextureNode {
  const node = nodeObject(NODE_OF_KIND[kind](value)) as unknown as TextureNode;
  node.mergeable = false;
  return node;
}
