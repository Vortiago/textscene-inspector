import type { StructValue } from '../language/emitValue.js';
import type { StructNode } from '../language/shaderTree.js';
import type { BlockPacking } from './blockLayout.js';
import { RowStore } from './rowStore.js';
import { RowBlock } from './rowBlock.js';
import type { InterfaceBlockNode } from './templateTree.js';

/** The stages of one program share them, so a buffer both stages declare is one region of one texture. */
export class TemplateBuffers {
  /** Written only by `block`, at a buffer's first block, by its instance name: `instances`. */
  readonly byName = new Map<string, RowBlock>();

  /** Written only by `block`, at the first buffer: one texture for every buffer, so one sampler for all. */
  private store: RowStore | undefined;

  /** The value of a `buffer` block's instance, read from its region of the store. */
  block(block: InterfaceBlockNode, structOf: (type: string) => StructNode | undefined): StructValue {
    const name = block.instanceName!;
    let rows = this.byName.get(name);
    if (!rows) {
      const members = block.members.flatMap((member) => (member.kind === 'slot' ? [] : [member]));
      this.byName.set(
        name,
        (rows = new RowBlock(members, packingOf(block), structOf, (this.store ??= new RowStore())))
      );
    }
    return rows.value;
  }
}

/** A buffer block's packing: Godot names std430 or std140 on each. */
function packingOf(block: InterfaceBlockNode): BlockPacking {
  const named = block.qualifiers.layout.find((entry) => entry.name === 'std430' || entry.name === 'std140');
  if (!named) throw new Error(`expected std430 or std140 on buffer ${block.blockName}, found neither`);
  return named.name as BlockPacking;
}
