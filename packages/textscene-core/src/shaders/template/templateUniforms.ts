/**
 * The TSL uniforms of a template stage's uniform blocks: one uniform per member, by
 * `instance.member`, and one array per member of an array of structs. The caller writes each
 * uniform's value from the three.js state the binding table names.
 */

import * as THREE from 'three';
import { uniform, uniformArray } from 'three/tsl';
import type { Node, UniformNode } from 'three/webgpu';
import type { ArrayValue, StructOf, StructValue, Value } from '../language/emitValue.js';
import type { StructMember } from '../language/shaderTree.js';
import { glslShapeOf } from './glslTypes.js';
import type { InterfaceBlockNode } from './templateTree.js';

/**
 * The uniforms of the blocks of a program's stages, by `instance.member`. The stages of one
 * program share them, so a block both stages declare is one set of uniforms.
 */
export class TemplateUniforms {
  /** Written only by `array` and `uniformOf`, at a member's first block. */
  readonly byName = new Map<string, UniformNode<unknown>>();

  /** The value of a uniform block's instance: a struct of its members' uniforms. */
  block(block: InterfaceBlockNode, structOf: StructOf): StructValue {
    const members = new Map<string, Value>();
    for (const member of block.members) {
      if (member.kind === 'slot') continue;
      members.set(member.name, this.member(`${block.instanceName}.${member.name}`, member, structOf));
    }
    return { kind: 'struct', members };
  }

  private member(name: string, member: StructMember, structOf: StructOf): Value {
    const struct = structOf(member.type);
    const count = member.arraySize ?? 0;
    if (struct && count === 0) return this.struct(name, struct.members, structOf);
    if (struct) return this.structArray(name, struct.members, count);
    if (count > 0) return this.array(name, member.type, count);
    return this.uniformOf(name, member.type);
  }

  /** A struct as one uniform per member: `scene_data.fog.color`. */
  private struct(name: string, members: readonly StructMember[], structOf: StructOf): StructValue {
    return {
      kind: 'struct',
      members: new Map(
        members.map((member) => [member.name, this.member(`${name}.${member.name}`, member, structOf)])
      ),
    };
  }

  /** An array of structs as one array per member: `directional_lights.data.enabled`. */
  private structArray(name: string, members: readonly StructMember[], count: number): ArrayValue {
    const arrays = members.map(
      (member) => [member.name, this.array(`${name}.${member.name}`, member.type, count)] as const
    );
    return {
      kind: 'array',
      count,
      element: (index) => ({
        kind: 'struct',
        members: new Map(arrays.map(([member, array]) => [member, array.element(index)])),
      }),
    };
  }

  private array(name: string, type: string, count: number): ArrayValue {
    const node =
      this.byName.get(name) ??
      uniformArray(Array.from({ length: count }, () => initialValue(type)) as never[], type);
    this.byName.set(name, node as unknown as UniformNode<unknown>);
    return {
      kind: 'array',
      count,
      element: (index) => (node as unknown as { element(index: Node | number): Node }).element(index),
    };
  }

  private uniformOf(name: string, type: string): Node {
    const node =
      (this.byName.get(name) as unknown as Node | undefined) ??
      (uniform as unknown as (value: unknown, type: string) => Node)(initialValue(type), type);
    this.byName.set(name, node as unknown as UniformNode<unknown>);
    return node as unknown as Node;
  }
}

/** The value a uniform of `type` holds before the caller writes one: zero, as an unwritten GPU buffer. */
function initialValue(type: string): unknown {
  const shape = glslShapeOf(type);
  if (!shape || shape.scalar === 'float16')
    throw new Error(`expected a uniform of a value type the emitter writes, got ${type}`);
  const zero = shape.scalar === 'bool' ? false : 0;
  if (shape.columns === 1 && shape.rows === 1) return zero;
  if (shape.columns === 1) return VECTORS[shape.rows]!();
  const matrix = MATRICES[shape.columns];
  if (!matrix || shape.rows !== shape.columns)
    throw new Error(`expected a square matrix uniform of 2 to 4 columns, got ${type}`);
  return matrix().fromArray(new Array(shape.columns * shape.rows).fill(0));
}

/** The three.js vector of each component count, which three binds as a vector of the uniform's type. */
const VECTORS: Readonly<Record<number, () => unknown>> = {
  2: () => new THREE.Vector2(),
  3: () => new THREE.Vector3(),
  4: () => new THREE.Vector4(),
};

const MATRICES: Readonly<Record<number, () => THREE.Matrix2 | THREE.Matrix3 | THREE.Matrix4>> = {
  2: () => new THREE.Matrix2(),
  3: () => new THREE.Matrix3(),
  4: () => new THREE.Matrix4(),
};
