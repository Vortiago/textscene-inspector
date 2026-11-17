import type { Variant } from '../../godot/variant/value/variant.js';
import type { Value } from '../language/emitValue.js';
import type { ShaderNode, UniformNode } from '../language/shaderTree.js';
import { defaultLanes, materialLanes } from './uniformLanes.js';
import { bitsUniform } from './uniformNodes.js';

/** A uniform of a transpiled shader, which takes the material's value. */
export interface TranspiledUniform {
  readonly declaration: UniformNode;
  /** The material's value, as `set_shader_parameter` gives it, or nothing for Godot's own value. */
  set(value: Variant | undefined): void;
}

/** A uniform's node, holding Godot's value for a material that sets none. */
export class UniformBinding implements TranspiledUniform {
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

  set(value: Variant | undefined): void {
    this.node.write(
      value === undefined
        ? defaultLanes(this.declaration, this.useLinearColor)
        : materialLanes(this.declaration, value, this.useLinearColor)
    );
  }
}

/** A binding for each uniform of `shader`, by name, in the order of the text. */
export const bindParameters = (
  shader: ShaderNode,
  useLinearColor: boolean
): ReadonlyMap<string, UniformBinding> =>
  new Map(shader.uniforms.map((uniform) => [uniform.name, new UniformBinding(uniform, useLinearColor)]));
