import type { StructValue } from '../language/emitValue.js';
import type { StructNode } from '../language/shaderTree.js';
import type { BlockPacking } from './blockLayout.js';
import { RowStore } from './rowStore.js';
import { RowBlock } from './rowBlock.js';
import type { InterfaceBlockNode } from './templateTree.js';

/** The stages of one program share them, so a buffer both stages declare is one texture. */
export class TemplateBuffers {
  /** Written only by `block`, at a buffer's first block, by its instance name: `instances`. */
  readonly byName = new Map<string, RowBlock>();

  /** One texture for every buffer, so the program reads one sampler for all of them. */
  private readonly store = new RowStore();

  /** The value of a `buffer` block's instance, read from its row texture. */
  block(block: InterfaceBlockNode, structOf: (type: string) => StructNode | undefined): StructValue {
    const name = block.instanceName!;
    let rows = this.byName.get(name);
    if (!rows) {
      const members = block.members.flatMap((member) => (member.kind === 'slot' ? [] : [member]));
      this.byName.set(name, (rows = new RowBlock(members, packingOf(block), structOf, this.store)));
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
