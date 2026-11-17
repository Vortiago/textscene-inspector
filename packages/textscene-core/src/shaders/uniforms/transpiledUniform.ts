import { NIL, type Variant } from '../../godot/variant/value/variant.js';
import type { Value } from '../language/emitValue.js';
import type { ShaderNode, UniformNode } from '../language/shaderTree.js';
import { isSamplerType } from '../language/types.js';
import { isSamplerValue, SamplerBinding, type SamplerValue } from './samplerUniform.js';
import type { ProjectSampling } from './samplerState.js';
import { SAMPLER_DEFAULTS } from './samplerTextures.js';
import { materialLanes } from './uniformLanes.js';
import { MaterialBits, slotsOf } from './uniformNodes.js';

/** A value as `set_shader_parameter` takes it: a Variant, or a texture or list of them for a sampler. */
export type ParameterValue = Variant | SamplerValue | null;

/** A uniform of a transpiled shader, which takes the material's value. */
export interface TranspiledUniform {
  readonly declaration: UniformNode;
  /** False while Godot cannot build the material's uniform set, so it does not draw the material. */
  readonly isDrawable: boolean;
  /** The material's value. Nothing, null or NIL erases it (`material.cpp:450`). */
  set(value: ParameterValue | undefined): void;
}

/** What every uniform of a shader takes from the material and the project. */
export interface BindingContext {
  /** Godot's `p_use_linear_color`. */
  readonly useLinearColor: boolean;
  readonly sampling: ProjectSampling;
}

/** A uniform's node, holding Godot's value for a material that sets none. */
class UniformBinding implements TranspiledUniform {
  private readonly node;
  readonly isDrawable = true;

  constructor(
    readonly declaration: UniformNode,
    bits: MaterialBits,
    private readonly useLinearColor: boolean
  ) {
    this.node = bits.uniform(declaration.type, declaration.arraySize ?? 0);
    this.set(NIL);
  }

  /** What a function of the shader reads. */
  get value(): Value {
    return this.node.value;
  }

  set(value: ParameterValue | undefined): void {
    if (isSamplerValue(value))
      throw new Error(`expected a Variant for ${this.declaration.name}, got a texture`);
    this.node.write(materialLanes(this.declaration, value ?? NIL, this.useLinearColor));
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
  const values = shader.uniforms.filter((uniform) => !isSamplerType(uniform.type));
  const bits = new MaterialBits(
    values.reduce((slots, uniform) => slots + slotsOf(uniform.type, uniform.arraySize ?? 0), 0)
  );
  const bindingOf = (uniform: UniformNode) =>
    isSamplerType(uniform.type)
      ? new SamplerBinding(uniform, samplerContext)
      : new UniformBinding(uniform, bits, context.useLinearColor);
  return new Map(shader.uniforms.map((uniform) => [uniform.name, bindingOf(uniform)]));
}
