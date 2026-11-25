import type { NodeHandle } from '../../../../scene/nodeHandle';
import { valueOfSceneValue, type SceneValue } from '../../../../scene/variant';
import { VARIANT_TYPE as T } from '../../../../godot/variant/variantType';
import {
  componentsOf,
  isPackedNumberType,
  type PackedNumberType,
  type VariantValue,
} from '../../../../godot/variant/variantValue';

/** One row of the inspector. */
export interface PropertyItem {
  label: string;
  value: string;
}

/** A titled group of rows. */
export interface PropertySection {
  title: string;
  items: PropertyItem[];
}

export interface InspectedNode {
  /** The property names the node's file and the files it instances set. */
  readonly fileProperties: ReadonlySet<string>;
  /** `get` of each of `properties`, all asked at once. */
  read<P extends string>(properties: readonly P[]): Promise<NodeValues<P>>;
  call: NodeHandle['call'];
}

/** The sections of one class, the rows of its base classes included. */
export type Formatter = (node: InspectedNode) => Promise<PropertySection[]>;

/** `get`'s answers, read as the types the class declares. A read of another type throws. */
export class NodeValues<P extends string> {
  constructor(private readonly answers: ReadonlyMap<P, SceneValue | null>) {}

  /** False where `get` answers null: the class has no such property. */
  has(property: P): boolean {
    return this.answers.get(property) != null;
  }

  number(property: P): number {
    const value = this.answer(property);
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return Number(value);
    throw this.mismatch(property, 'a number');
  }

  boolean(property: P): boolean {
    const value = this.answer(property);
    if (typeof value === 'boolean') return value;
    throw this.mismatch(property, 'a boolean');
  }

  /** A String, a StringName or a NodePath, unquoted. */
  string(property: P): string {
    const value = this.value(property);
    if (value.type === T.STRING || value.type === T.STRING_NAME || value.type === T.NODE_PATH)
      return value.value;
    throw this.mismatch(property, 'a string');
  }

  /** Each number of a vector, a colour, a rectangle or a packed array, in their order. */
  numbers(property: P): readonly number[] {
    const value = this.value(property);
    const numbers = componentsOf(value) ?? packedNumbersOf(value);
    if (numbers) return numbers;
    throw this.mismatch(property, 'numbers');
  }

  /** The path of the resource an Object property holds, null for none, else the Object's text. */
  resource(property: P): string | null {
    const value = this.value(property);
    if (value.type === T.NIL) return null;
    if (value.type !== T.OBJECT) return this.text(property);
    // A null Object is an Object with no class: `var_to_str` writes it `null`.
    return value.resource?.path ?? (value.className ? this.text(property) : null);
  }

  /** The value as `var_to_str` writes it. */
  text(property: P): string {
    const value = this.answer(property);
    return typeof value === 'object' ? value.text : String(value);
  }

  private value(property: P): VariantValue {
    return valueOfSceneValue(this.answer(property));
  }

  private answer(property: P): SceneValue {
    const value = this.answers.get(property);
    if (value === undefined) throw new Error(`expected a read of ${property}, found none asked`);
    if (value === null) throw this.mismatch(property, 'a value');
    return value;
  }

  private mismatch(property: P, expected: string): Error {
    return new Error(
      `expected ${property} to answer ${expected}, got ${JSON.stringify(this.answers.get(property))}`
    );
  }
}

/** The handle's `get`, each property asked once, its `call`, and the names the file sets. */
export function inspectedNode(node: NodeHandle, fileProperties: readonly string[]): InspectedNode {
  const asked = new Map<string, Promise<SceneValue | null>>();
  const get = (property: string): Promise<SceneValue | null> => {
    let answer = asked.get(property);
    if (!answer) asked.set(property, (answer = node.get(property)));
    return answer;
  };
  return {
    fileProperties: new Set(fileProperties),
    read: async (properties) => {
      const answers = await Promise.all(properties.map(get));
      return new NodeValues(new Map(properties.map((property, index) => [property, answers[index]!])));
    },
    call: node.call.bind(node),
  };
}

function packedNumbersOf(value: VariantValue): readonly number[] | undefined {
  return isPackedNumberType(value.type)
    ? (value as Extract<VariantValue, { type: PackedNumberType }>).value
    : undefined;
}
