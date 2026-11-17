import type { Texture } from 'three';
import type { Variant } from '../../godot/variant/value/variant.js';
import type { Value } from '../language/emitValue.js';
import type { ShaderNode, UniformNode } from '../language/shaderTree.js';
import { shapeOf } from '../language/types.js';
import { SamplerBinding, type SamplerValue } from './samplerUniform.js';
import type { ProjectSampling } from './samplerState.js';
import { SAMPLER_DEFAULTS } from './samplerTextures.js';
import { defaultLanes, materialLanes } from './uniformLanes.js';
import { bitsUniform } from './uniformNodes.js';

/** A value as `set_shader_parameter` takes it: a Variant, or a texture or list of them for a sampler. */
export type ParameterValue = Variant | SamplerValue;

/** A uniform of a transpiled shader, which takes the material's value. */
export interface TranspiledUniform {
  readonly declaration: UniformNode;
  /** The material's value, or nothing for Godot's own value. */
  set(value: ParameterValue | undefined): void;
}

/** What every uniform of a shader takes from the material and the project. */
export interface BindingContext {
  /** Godot's `p_use_linear_color`. */
  readonly useLinearColor: boolean;
  readonly sampling: ProjectSampling;
}

const isSamplerValue = (value: ParameterValue): value is SamplerValue =>
  value === null || Array.isArray(value) || (value as Texture).isTexture === true;

/** A uniform's node, holding Godot's value for a material that sets none. */
class UniformBinding implements TranspiledUniform {
  private readonly node;

  constructor(
    readonly declaration: UniformNode,
    private readonly useLinearColor: boolean
  ) {
    this.node = bitsUniform(declaration.type, declaration.arraySize ?? 0);
    this.set(undefined);
  }

  /** What a function of the shader reads. */
  get value(): Value {
    return this.node.value;
  }

  set(value: ParameterValue | undefined): void {
    if (value !== undefined && isSamplerValue(value))
      throw new Error(`expected a Variant for ${this.declaration.name}, got a texture`);
    this.node.write(
      value === undefined
        ? defaultLanes(this.declaration, this.useLinearColor)
        : materialLanes(this.declaration, value, this.useLinearColor)
    );
  }
}

/** A Variant names no texture, so a sampler reads it as the null texture (`material_storage.cpp:937`). */
class SamplerParameter implements TranspiledUniform {
  constructor(private readonly binding: SamplerBinding) {}

  get declaration(): UniformNode {
    return this.binding.declaration;
  }

  get value(): Value {
    return this.binding.value;
  }

  set(value: ParameterValue | undefined): void {
    this.binding.set(value === undefined || isSamplerValue(value) ? value : null);
  }
}

/** A text with no head is a probe's, which Godot's harness draws as a `canvas_item`. */
const samplerDefaultsOf = (shaderType: string | undefined) => SAMPLER_DEFAULTS[shaderType ?? 'canvas_item']!;

/** A binding for each uniform of `shader`, by name, in the order of the text. */
export function bindParameters(
  shader: ShaderNode,
  context: BindingContext
): ReadonlyMap<string, TranspiledUniform & { readonly value: Value }> {
  const samplerContext = { ...context, defaults: samplerDefaultsOf(shader.shaderType) };
  const bindingOf = (uniform: UniformNode) =>
    shapeOf(uniform.type) === undefined
      ? new SamplerParameter(new SamplerBinding(uniform, samplerContext))
      : new UniformBinding(uniform, context.useLinearColor);
  return new Map(shader.uniforms.map((uniform) => [uniform.name, bindingOf(uniform)]));
}
