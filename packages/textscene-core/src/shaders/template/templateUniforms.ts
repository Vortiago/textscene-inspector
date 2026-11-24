import * as THREE from 'three';
import { uniform } from 'three/tsl';
import type { Node, UniformNode } from 'three/webgpu';
import type { ArrayValue, StructOf, StructValue, Value } from '../language/emitValue.js';
import type { StructMember } from '../language/shaderTree.js';
import { BlockArrays } from './blockArrays.js';
import { glslShapeOf } from './glslTypes.js';
import { Specialisation } from './specialisation.js';
import type { InterfaceBlockNode } from './templateTree.js';

/** The stages of one program share them, so a block both stages declare is one set. */
export class TemplateUniforms {
  /** Written only by `array` and `uniformOf`, at a member's first block. An array holds only `array`. */
  readonly byName = new Map<string, UniformNode<unknown>>();

  /** Written only by `block`: the arrays of each block by instance name, which both stages share. */
  private readonly blockArrays = new Map<string, BlockArrays>();

  /** Written only by `array`: each array's value, which the second stage's declaration reads. */
  private readonly arrayValues = new Map<string, ArrayValue>();

  /** Written only by `specialisation`: the program's specialisation constants, which its materials key on. */
  readonly specialisations = new Map<string, Specialisation>();

  /** `specialisedMembers` names each block member that folds as a specialisation constant (ADR-0088). */
  constructor(private readonly specialisedMembers: ReadonlySet<string> = new Set()) {}

  /** The value of a uniform block's instance: a struct of its members' uniforms. */
  block(block: InterfaceBlockNode, structOf: StructOf): StructValue {
    const name = block.instanceName!;
    const arrays = this.blockArrays.get(name) ?? new BlockArrays(name);
    this.blockArrays.set(name, arrays);
    const members = new Map<string, Value>();
    for (const member of block.members) {
      if (member.kind === 'slot') continue;
      members.set(member.name, this.member(`${name}.${member.name}`, member, structOf, arrays));
    }
    arrays.seal();
    return { kind: 'struct', members };
  }

  private member(name: string, member: StructMember, structOf: StructOf, arrays: BlockArrays): Value {
    const struct = structOf(member.type);
    const count = member.arraySize ?? 0;
    if (struct && count === 0) return this.struct(name, struct.members, structOf, arrays);
    if (struct) return this.structArray(name, struct.members, count, arrays);
    if (count > 0) return this.array(name, member.type, count, arrays);
    if (this.specialisedMembers.has(name))
      return this.specialisation(name, member.type, initialValue(member.type) as number | boolean);
    return this.uniformOf(name, member.type);
  }

  /** A struct as one uniform per member: `scene_data.fog.color`. */
  private struct(
    name: string,
    members: readonly StructMember[],
    structOf: StructOf,
    arrays: BlockArrays
  ): StructValue {
    return {
      kind: 'struct',
      members: new Map(
        members.map((member) => [
          member.name,
          this.member(`${name}.${member.name}`, member, structOf, arrays),
        ])
      ),
    };
  }

  /** An array of structs as one array per member: `directional_lights.data.enabled`. */
  private structArray(
    name: string,
    members: readonly StructMember[],
    count: number,
    arrays: BlockArrays
  ): ArrayValue {
    const memberArrays = members.map(
      (member) => [member.name, this.array(`${name}.${member.name}`, member.type, count, arrays)] as const
    );
    return {
      kind: 'array',
      count,
      element: (index) => ({
        kind: 'struct',
        members: new Map(memberArrays.map(([member, array]) => [member, array.element(index)])),
      }),
    };
  }

  /** An array of the block's buffer, the same one at a second stage's declaration of the block. */
  private array(name: string, type: string, count: number, arrays: BlockArrays): ArrayValue {
    const known = this.arrayValues.get(name);
    if (known) return known;
    const { value, written } = arrays.add(name, type, count);
    this.arrayValues.set(name, value);
    this.byName.set(name, written as unknown as UniformNode<unknown>);
    return value;
  }

  /** The literal of the specialisation constant `name`, at its declared value until a binding writes it. */
  specialisation(name: string, type: string, declared: number | boolean): Node {
    let constant = this.specialisations.get(name);
    if (!constant) {
      constant = new Specialisation(type, declared);
      this.specialisations.set(name, constant);
    }
    return constant.literal();
  }

  /** The uniform `name` of `type`, which a block member of that name shares once a stage declares it. */
  uniformOf(name: string, type: string): Node {
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
