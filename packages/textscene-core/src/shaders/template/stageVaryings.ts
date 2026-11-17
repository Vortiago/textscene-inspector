import { int, select } from 'three/tsl';
import { PropertyNode, type Node, type NodeBuilder } from 'three/webgpu';
import type { ArrayValue } from '../language/emitValue.js';

/** What a flat varying uses of three's `PropertyNode`, which three's types leave out. */
interface Property {
  readonly name: string;
  getNodeType(builder: NodeBuilder): string;
  generate(builder: NodeBuilder): string;
}

type VaryingBuilder = NodeBuilder & {
  getVaryingFromNode(node: unknown, name: string, type: string, interpolation: string): unknown;
};

const PropertyBase = PropertyNode as unknown as new (
  type: string,
  name: string,
  isVarying: boolean
) => Property;

/** A varying three writes `flat`: one vertex's value for the whole primitive. */
class FlatVarying extends PropertyBase {
  override generate(builder: NodeBuilder): string {
    // The first lookup makes the varying, so this one holds the interpolation for the generate after it.
    (builder as VaryingBuilder).getVaryingFromNode(this, this.name, this.getNodeType(builder), 'flat');
    return super.generate(builder);
  }
}

/** The vertex stage's `out` globals and the fragment stage's `in` globals, one TSL varying by name. */
export class StageVaryings {
  /** Written only by `of`, at a varying's first stage. */
  private readonly byName = new Map<string, Node>();

  /** The varying `name` of `type`, `flat` as its first stage declares it: the stages of a template agree. */
  of(type: string, name: string, isFlat: boolean): Node {
    let varying = this.byName.get(name);
    if (!varying) {
      varying = (isFlat
        ? new FlatVarying(type, name, true)
        : new PropertyBase(type, name, true)) as unknown as Node;
      this.byName.set(name, varying);
    }
    return varying;
  }

  /** An array varying as one varying for each element, as three declares no array varying. */
  ofArray(type: string, name: string, count: number, isFlat: boolean): ArrayValue {
    const elements = Array.from({ length: count }, (_, index) => this.of(type, `${name}_${index}`, isFlat));
    return {
      kind: 'array',
      count,
      element: (index) => (typeof index === 'number' ? elements[index]! : selected(elements, index)),
    };
  }
}

/** The element at a computed index, read by comparing the index with each one. */
function selected(elements: readonly Node[], index: Node): Node {
  const at = int(index as never);
  return elements
    .slice(0, -1)
    .reduceRight<Node>(
      (rest, element, position) =>
        select(at.equal(position), element as never, rest as never) as unknown as Node,
      elements.at(-1)!
    );
}
