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
import type { InterfaceBlockNode } from './templateTree.js';

/** The uniforms of the blocks of a stage, by `instance.member`, and each block's value by its instance name. */
export class TemplateUniforms {
  /** Written only by `uniformOf`, while a block's value is built. */
  readonly byName = new Map<string, UniformNode<unknown>>();

  constructor(private readonly structOf: StructOf) {}

  /** The value of a uniform block's instance: a struct of its members' uniforms. */
  block(block: InterfaceBlockNode): StructValue {
    const members = new Map<string, Value>();
    for (const member of block.members) {
      if (member.kind === 'slot') continue;
      members.set(member.name, this.member(`${block.instanceName}.${member.name}`, member));
    }
    return { kind: 'struct', members };
  }

  private member(name: string, member: StructMember): Value {
    const struct = this.structOf(member.type);
    const count = member.arraySize ?? 0;
    if (struct) return this.structArray(name, struct.members, count);
    if (count > 0) return this.array(name, member.type, count);
    return this.uniformOf(name, member.type);
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
    const node = uniformArray(Array.from({ length: count }, () => initialValue(type)) as never[], type);
    this.byName.set(name, node as unknown as UniformNode<unknown>);
    return {
      kind: 'array',
      count,
      element: (index) => (node as unknown as { element(index: Node | number): Node }).element(index),
    };
  }

  private uniformOf(name: string, type: string): Node {
    const node = (uniform as unknown as (value: unknown, type: string) => Node)(initialValue(type), type);
    this.byName.set(name, node as unknown as UniformNode<unknown>);
    return node as unknown as Node;
  }
}

/** The value a uniform of `type` holds before the caller writes one: zero, as an unwritten GPU buffer. */
function initialValue(type: string): unknown {
  switch (type) {
    case 'bool':
      return false;
    case 'int':
    case 'uint':
    case 'float':
      return 0;
    case 'vec2':
      return new THREE.Vector2();
    case 'vec3':
      return new THREE.Vector3();
    case 'vec4':
      return new THREE.Vector4();
    case 'mat3':
      return new THREE.Matrix3().set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    case 'mat4':
      return new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    default:
      throw new Error(`expected a uniform of a value type the emitter writes, got ${type}`);
  }
}
