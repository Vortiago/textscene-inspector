import { Data3DTexture, NoColorSpace, SRGBColorSpace, type Texture } from 'three';
import { texture, texture3D } from 'three/tsl';
import { CubeTextureNode, type Node, type NodeBuilder, type TextureNode } from 'three/webgpu';
import type { ArrayValue, Value } from '../language/emitValue.js';
import type { UniformNode, ValueType } from '../language/shaderTree.js';
import { defaultTexture, type TextureKind } from './defaultTextures.js';
import { samplerState, type ProjectSampling } from './samplerState.js';
import {
  samplerSettings,
  samplerTextures,
  type DefaultTexture,
  type SamplerSettings,
} from './samplerTextures.js';

/** What a sampler takes from the shader around it. */
export interface SamplerContext {
  /** The filter and repeat of the shader type, for a sampler that names neither. */
  readonly defaults: SamplerSettings;
  readonly sampling: ProjectSampling;
  /** Godot's `p_use_linear_color`: a `source_color` texture reads through its sRGB view. */
  readonly useLinearColor: boolean;
}

/** A texture, a list of them for an array, or null for none, as `set_shader_parameter` takes them. */
export type SamplerValue = Texture | readonly (Texture | null)[] | null;

/** A cube read with the direction as Vulkan and GL define it: three mirrors x for its own cubes. */
class GodotCubeNode extends CubeTextureNode {
  /** three's `CubeTextureNode.setupUV`, which its types leave out. */
  setupUV(_builder: NodeBuilder, uvNode: Node): Node {
    return uvNode;
  }
}

export function textureKind(type: ValueType): TextureKind {
  if (type === 'samplerCube' || type === 'samplerCubeArray') return 'cube';
  if (type.endsWith('sampler3D')) return 'volume';
  if (type.endsWith('sampler2DArray')) return 'layers';
  return 'flat';
}

const NODE_OF_KIND: Readonly<Record<TextureKind, (value: Texture) => TextureNode>> = {
  flat: (value) => texture(value),
  layers: (value) => texture(value),
  volume: (value) => texture3D(value) as unknown as TextureNode,
  cube: (value) => new GodotCubeNode(value as never),
};

/** The mip levels a texture holds: its own list, or the chain three generates for it. */
function levelsOf(source: Texture): number {
  if (source.mipmaps && source.mipmaps.length > 0) return source.mipmaps.length;
  if (!source.generateMipmaps) return 1;
  const { width = 1, height = 1 } = (source.image ?? {}) as { width?: number; height?: number };
  return Math.floor(Math.log2(Math.max(width, height, 1))) + 1;
}

/** A sampler uniform: one texture node per element, each reading a copy with the shader's sampler. */
export class SamplerBinding {
  private readonly nodes: TextureNode[];
  private readonly kind: TextureKind;
  private readonly settings: SamplerSettings;
  private readonly isSrgb: boolean;
  /** Written only by `copyOf`: a material texture's copy, kept while the texture lives. */
  private readonly copies = new WeakMap<Texture, Texture>();

  constructor(
    readonly declaration: UniformNode,
    private readonly context: SamplerContext
  ) {
    this.kind = textureKind(declaration.type);
    this.settings = samplerSettings(declaration, context.defaults);
    this.isSrgb = context.useLinearColor && declaration.usesColor;
    const count = Math.max(1, declaration.arraySize ?? 0);
    this.nodes = Array.from({ length: count }, () =>
      NODE_OF_KIND[this.kind](defaultTexture(this.kind, 'white'))
    );
    this.set(undefined);
  }

  /** What a function of the shader reads: a texture node, or an array of them. */
  get value(): Value {
    if (this.declaration.arraySize === undefined) return this.nodes[0]!;
    return { kind: 'array', count: this.nodes.length, element: (index) => this.element(index) } as ArrayValue;
  }

  set(value: SamplerValue | undefined): void {
    samplerTextures<Texture>(this.declaration, value).forEach((chosen, index) => {
      this.nodes[index]!.value = typeof chosen === 'string' ? this.defaultOf(chosen) : this.copyOf(chosen);
    });
  }

  private element(index: Node | number): TextureNode {
    if (typeof index !== 'number') throw new Error(`expected a constant index into ${this.declaration.name}`);
    return this.nodes[index]!;
  }

  private defaultOf(chosen: DefaultTexture): Texture {
    return defaultTexture(this.kind, chosen);
  }

  private copyOf(source: Texture): Texture {
    let copy = this.copies.get(source);
    if (copy) return copy;
    copy = source.clone();
    const state = samplerState(this.settings, levelsOf(source), this.context.sampling);
    copy.flipY = false;
    copy.magFilter = state.magFilter;
    copy.minFilter = state.minFilter;
    copy.wrapS = copy.wrapT = state.wrap;
    if (copy instanceof Data3DTexture) copy.wrapR = state.wrap;
    copy.anisotropy = state.anisotropy;
    copy.colorSpace = this.isSrgb ? SRGBColorSpace : NoColorSpace;
    copy.needsUpdate = true;
    this.copies.set(source, copy);
    return copy;
  }
}
