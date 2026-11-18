import { NIL, type Variant } from '../../godot/variant/value/variant.js';
import type { Value } from '../language/emitValue.js';
import type { ShaderNode, UniformNode } from '../language/shaderTree.js';
import { ShadingLanguageError } from '../language/shadingLanguageError.js';
import { isSamplerType } from '../language/types.js';
import { blockLayout } from '../template/blockLayout.js';
import { isSamplerValue, SamplerBinding, type SamplerValue } from './samplerUniform.js';
import type { ProjectSampling } from './samplerState.js';
import { SAMPLER_DEFAULTS } from './samplerTextures.js';
import { materialLanes } from './uniformLanes.js';
import { materialBits, type UniformValue } from './uniformNodes.js';

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
  readonly isDrawable = true;

  constructor(
    readonly declaration: UniformNode,
    private readonly node: UniformValue,
    private readonly useLinearColor: boolean
  ) {
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

/** Godot warns past it (`shader_language.cpp:9220`): Chromium on lavapipe has the same block size. */
const BLOCK_BYTES_AT_MOST = 65536;

/** Godot draws a larger block if its driver takes it. WebGL does not link it, so this names the uniform. */
function refuseOverfullBlock(block: readonly UniformNode[]): void {
  const { members, size } = blockLayout(block, 'std140', () => undefined);
  if (size <= BLOCK_BYTES_AT_MOST) return;
  const index = members.findIndex((_, at) => (members[at + 1]?.offset ?? size) > BLOCK_BYTES_AT_MOST);
  const uniform = block[index]!;
  throw new ShadingLanguageError(
    `Uniform '${uniform.name}' ends past the ${BLOCK_BYTES_AT_MOST} bytes of a WebGL uniform block: the material's uniforms take ${size} bytes.`,
    uniform.position,
    '#2008'
  );
}

/** Only `local` uniforms take Godot's block offsets (`shader_compiler.cpp:567`, `:629`). */
function valueNodes(values: readonly UniformNode[]): ReadonlyMap<UniformNode, UniformValue> {
  const nodeOf = new Map<UniformNode, UniformValue>();
  const locals = values.filter(({ scope }) => scope === 'local');
  const others = values.filter(({ scope }) => scope !== 'local');
  for (const block of [locals, others]) {
    refuseOverfullBlock(block);
    materialBits(block).forEach((node, index) => nodeOf.set(block[index]!, node));
  }
  return nodeOf;
}

/** A binding for each uniform of `shader`, by name, in the order of the text. */
export function bindParameters(
  shader: ShaderNode,
  context: BindingContext
): ReadonlyMap<string, TranspiledUniform & { readonly value: Value }> {
  const samplerContext = { ...context, defaults: samplerDefaultsOf(shader.shaderType) };
  const nodeOf = valueNodes(shader.uniforms.filter((uniform) => !isSamplerType(uniform.type)));
  const bindingOf = (uniform: UniformNode) =>
    isSamplerType(uniform.type)
      ? new SamplerBinding(uniform, samplerContext)
      : new UniformBinding(uniform, nodeOf.get(uniform)!, context.useLinearColor);
  return new Map(shader.uniforms.map((uniform) => [uniform.name, bindingOf(uniform)]));
}
