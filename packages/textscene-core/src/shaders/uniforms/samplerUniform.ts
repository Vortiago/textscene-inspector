import {
  CompressedArrayTexture,
  Data3DTexture,
  DataArrayTexture,
  NoColorSpace,
  RGBAFormat,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { texture, texture3D } from 'three/tsl';
import { CubeTextureNode, type Node, type NodeBuilder, type TextureNode } from 'three/webgpu';
import type { ArrayValue, Value } from '../language/emitValue.js';
import { SamplerChoice } from '../language/textureCalls.js';
import type { UniformNode } from '../language/shaderTree.js';
import { textureKindOf, type TextureKind } from '../language/types.js';
import type { ParameterValue, TranspiledUniform } from './transpiledUniform.js';
import { defaultTexture } from './defaultTextures.js';
import { samplerState, type ProjectSampling } from './samplerState.js';
import { levelsOf } from './textureLevels.js';
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

export const isSamplerValue = (value: ParameterValue): value is SamplerValue =>
  value === null || Array.isArray(value) || (value as Texture).isTexture === true;

/** A cube read with the direction as Vulkan and GL define it: three mirrors x for its own cubes. */
class GodotCubeNode extends CubeTextureNode {
  /** three's `CubeTextureNode.setupUV`, which its types leave out. */
  setupUV(_builder: NodeBuilder, uvNode: Node): Node {
    return uvNode;
  }
}

const NODE_OF_KIND: Readonly<Record<TextureKind, (value: Texture) => TextureNode>> = {
  flat: (value) => texture(value),
  layers: (value) => texture(value),
  volume: (value) => texture3D(value) as unknown as TextureNode,
  cube: (value) => new GodotCubeNode(value as never),
};

/** Unmergeable: three gives one sampler to nodes of one texture, so two unset samplers would stay one. */
function nodeOf(kind: TextureKind, value: Texture): TextureNode {
  const node = NODE_OF_KIND[kind](value);
  node.mergeable = false;
  return node;
}

/** Written only by `levelledCopyOf`: one upload of a 2D array's levels, which every sampler copy shares. */
// eslint-disable-next-line no-restricted-syntax -- perObject is outside the shader module, which imports only its own files (ADR-0072).
const LEVELLED_COPIES = new WeakMap<DataArrayTexture, CompressedArrayTexture>();

/** A copy that shares the image of `source`, and so its upload, with every other copy. */
function cloneOf(source: Texture): Texture {
  if (!(source instanceof DataArrayTexture) || source.format !== RGBAFormat || source.mipmaps.length < 2)
    return source.clone();
  let levelled = LEVELLED_COPIES.get(source);
  if (!levelled) LEVELLED_COPIES.set(source, (levelled = levelledCopyOf(source)));
  return levelled.clone();
}

/** three uploads level 0 of a `DataArrayTexture` only (`WebGLTextures.js:1229`), every level of this one. */
function levelledCopyOf(source: DataArrayTexture): CompressedArrayTexture {
  const { width, height, depth } = source.image;
  const copy = new CompressedArrayTexture(
    source.mipmaps as never,
    width,
    height,
    depth,
    RGBAFormat as never,
    source.type
  );
  copy.internalFormat = source.internalFormat;
  copy.unpackAlignment = source.unpackAlignment;
  return copy;
}

const isDrawableWith = (chosen: readonly (Texture | DefaultTexture)[]) => !chosen.includes('none');

/** A sampler uniform: one texture node per element, each reading a copy with the shader's sampler. */
export class SamplerBinding implements TranspiledUniform {
  private readonly nodes: TextureNode[];
  private readonly kind: TextureKind;
  private readonly settings: SamplerSettings;
  private readonly isSrgb: boolean;
  /** False while an element reads no texture at all: Godot then builds no uniform set and draws nothing. */
  isDrawable: boolean;
  /** Written only by `copyOf`: a material texture's copy, kept while the texture lives. */
  private readonly copies = new WeakMap<Texture, Texture>();

  constructor(
    readonly declaration: UniformNode,
    private readonly context: SamplerContext
  ) {
    this.kind = textureKindOf(declaration.type);
    this.settings = samplerSettings(declaration, context.defaults);
    this.isSrgb = context.useLinearColor && declaration.usesColor;
    const chosen = samplerTextures<Texture>(declaration, undefined);
    this.nodes = chosen.map((texture) => nodeOf(this.kind, this.textureOf(texture)));
    this.isDrawable = isDrawableWith(chosen);
  }

  /** What a function of the shader reads: a texture node, or an array of them. */
  get value(): Value {
    if (this.declaration.arraySize === undefined) return this.nodes[0]!;
    return { kind: 'array', count: this.nodes.length, element: (index) => this.element(index) } as ArrayValue;
  }

  /** A Variant names no texture, so a sampler reads it as the null texture (`material_storage.cpp:937`). */
  set(value: ParameterValue | undefined): void {
    const chosen = samplerTextures<Texture>(
      this.declaration,
      value === undefined || isSamplerValue(value) ? value : null
    );
    chosen.forEach((texture, index) => (this.nodes[index]!.value = this.textureOf(texture)));
    this.isDrawable = isDrawableWith(chosen);
  }

  private textureOf(chosen: Texture | DefaultTexture): Texture {
    return typeof chosen === 'string' ? defaultTexture(this.kind, chosen) : this.copyOf(chosen);
  }

  private element(index: Node | number): Value {
    if (typeof index === 'number') return this.nodes[index]!;
    return new SamplerChoice(this.nodes, index) as unknown as Value;
  }

  private copyOf(source: Texture): Texture {
    let copy = this.copies.get(source);
    if (copy) return copy;
    copy = cloneOf(source);
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
