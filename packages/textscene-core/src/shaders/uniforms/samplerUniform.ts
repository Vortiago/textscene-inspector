import { Data3DTexture, NoColorSpace, SRGBColorSpace, type Texture } from 'three';
import type { Node, TextureNode } from 'three/webgpu';
import type { ArrayValue, Value } from '../language/emitValue.js';
import { SamplerChoice } from '../language/textureCalls.js';
import type { UniformNode } from '../language/shaderTree.js';
import { textureKindOf, type TextureKind } from '../language/types.js';
import type { ParameterValue, TranspiledUniform } from './transpiledUniform.js';
import { defaultTexture } from './defaultTextures.js';
import { samplerNodeOf } from './samplerNodes.js';
import { samplerState, type ProjectSampling } from './samplerState.js';
import { levelsOf } from './textureLevels.js';
import { TextureCopies } from './textureCopies.js';
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

/** A texture, or a list of them for an array with null for a missing element. */
export type SamplerValue = Texture | readonly (Texture | null)[];

export const isSamplerValue = (value: ParameterValue | undefined): value is SamplerValue =>
  Array.isArray(value) || (value as Texture | null | undefined)?.isTexture === true;

/** A Variant names no texture, so a sampler reads it as the null texture (`material_storage.cpp:937`). */
function texturesOf(value: ParameterValue | undefined): SamplerValue | null | undefined {
  if (value === undefined || value === null || isSamplerValue(value)) return value;
  return value.type === 'NIL' ? undefined : [null];
}

const isDrawableWith = (chosen: readonly (Texture | DefaultTexture)[]) => !chosen.includes('none');

/** A sampler uniform: one texture node per element, each reading a copy with the shader's sampler. */
export class SamplerBinding implements TranspiledUniform {
  private readonly nodes: TextureNode[];
  private readonly kind: TextureKind;
  private readonly copies: TextureCopies;
  /** False while an element reads no texture at all: Godot then builds no uniform set and draws nothing. */
  isDrawable = false;
  /** Written only by `textureOf`: the binding's own default textures, collected with it. */
  private readonly defaultTextures = new Map<DefaultTexture, Texture>();

  constructor(
    readonly declaration: UniformNode,
    context: SamplerContext
  ) {
    this.kind = textureKindOf(declaration.type);
    const settings = samplerSettings(declaration, context.defaults);
    const isSrgb = context.useLinearColor && declaration.usesColor;
    this.copies = new TextureCopies((copy, source) => {
      const state = samplerState(settings, levelsOf(source), context.sampling);
      copy.flipY = false;
      copy.magFilter = state.magFilter;
      copy.minFilter = state.minFilter;
      copy.wrapS = copy.wrapT = state.wrap;
      if (copy instanceof Data3DTexture) copy.wrapR = state.wrap;
      copy.anisotropy = state.anisotropy;
      // A render target's copy holds the target's bytes, so it decodes them as the target does.
      copy.colorSpace = copy.isRenderTargetTexture
        ? source.colorSpace
        : isSrgb
          ? SRGBColorSpace
          : NoColorSpace;
    });
    const placeholder = this.textureOf('white');
    this.nodes = Array.from({ length: Math.max(1, declaration.arraySize ?? 0) }, () =>
      samplerNodeOf(this.kind, placeholder)
    );
    this.set(undefined);
  }

  /** What a function of the shader reads: a texture node, or an array of them. */
  get value(): Value {
    if (this.declaration.arraySize === undefined) return this.nodes[0]!;
    return { kind: 'array', count: this.nodes.length, element: (index) => this.element(index) } as ArrayValue;
  }

  set(value: ParameterValue | undefined): void {
    const chosen = samplerTextures<Texture>(this.declaration, texturesOf(value));
    chosen.forEach((texture, index) => (this.nodes[index]!.value = this.textureOf(texture)));
    this.copies.release(this.nodes.map((node) => node.value));
    this.isDrawable = isDrawableWith(chosen);
  }

  private textureOf(chosen: Texture | DefaultTexture): Texture {
    if (typeof chosen !== 'string') return this.copies.copyOf(chosen);
    const made = this.defaultTextures.get(chosen) ?? defaultTexture(this.kind, chosen);
    this.defaultTextures.set(chosen, made);
    return made;
  }

  private element(index: Node | number): Value {
    if (typeof index === 'number') return this.nodes[index]!;
    return new SamplerChoice(this.nodes, index) as unknown as Value;
  }
}
