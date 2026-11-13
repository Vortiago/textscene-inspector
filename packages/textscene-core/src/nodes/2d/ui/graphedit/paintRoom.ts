/**
 * The draw order of a GraphEdit's children. GraphEdit moves each GraphFrame to index 0 and its
 * `connections_layer` to the index after the frames (`graph_edit.cpp:714-717`, `:3189-3190`), so
 * the frames draw in reverse scene order, then the connections, then the other children.
 */

import type { TscnNode } from '../../../../parser/types';
import { descendsFromClass } from '../../../../godot/classdb/classBaseTypes';
import { LISTED_LAYER, type PaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';

export const graphEditPaintRoom: PaintRoom = {
  listedOrder: (_node: TscnNode, children: readonly TscnNode[]) => {
    const isFrame = children.map((child) => descendsFromClass(child.type, 'GraphFrame'));
    const indices = children.map((_, index) => index);
    const frames = indices.filter((index) => isFrame[index]).reverse();
    return [...frames, LISTED_LAYER, ...indices.filter((index) => !isFrame[index])];
  },
};
