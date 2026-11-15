/**
 * The draw-sequence room a node type holds beside its authored children, which Godot fills with
 * children no `.tscn` lists. A slice registers its room with its parser, which every scene loads
 * before a pass runs, so the allocation stays a pure function of the tree. React- and THREE-free.
 */

import type { TscnNode } from '../../parser/types';
import type { LiveNode } from '../../resources/liveNode';
import { createTypeRegistry } from '../../core/createTypeRegistry';
import { findInClassChain } from '../../godot/classdb/classBaseTypes';

/**
 * Room held back inside a node whose drawn pieces the tree does not list (`reservesTail`). It keeps
 * the allocation a pure function of the tree, so the two walks agree without waiting on a resource.
 */
export const DYNAMIC_CHILD_RESERVE = 4096;

/** Marks the parent's own listed layer in a `listedOrder`. */
export const LISTED_LAYER = -1;

export interface PaintRoom {
  /**
   * Whether the node draws pieces the tree does not list after its children, such as a tile layer's
   * y-sort rows and scene tiles, which take a reserve.
   */
  reservesTail?: (node: TscnNode) => boolean;
  /** Its internal front children, which draw before every authored child, each in a run of its own. */
  frontChildren?: (node: TscnNode) => readonly LiveNode[];
  /** How many values its internal back children take, which draw after its whole subtree. */
  backRoom?: (node: TscnNode) => number;
  /**
   * The order it draws `children` in, as indices into them, with `LISTED_LAYER` where its own
   * listed layer draws, or undefined for scene order.
   */
  listedOrder?: (node: TscnNode, children: readonly TscnNode[]) => number[] | undefined;
}

const paintRooms = createTypeRegistry<PaintRoom>('PaintRoomRegistry');

/** Declares the room `typeName` and every class below it hold, unless a nearer class declares one. */
export function registerPaintRoom(typeName: string, room: PaintRoom): void {
  paintRooms.register(typeName, room);
  roomsByType.clear();
}

/** Written by {@link paintRoomOf}, and cleared by each registration, which can change any chain's room. */
const roomsByType = new Map<string, PaintRoom>();

/** The room `type` holds: each part from the nearest class in its chain that declares it. */
export function paintRoomOf(type: string): PaintRoom {
  let room = roomsByType.get(type);
  if (room) return room;
  const merged: Record<string, unknown> = {};
  findInClassChain(type, (className) => {
    const declared = paintRooms.get(className);
    if (declared) for (const [part, value] of Object.entries(declared)) merged[part] ??= value;
    return undefined;
  });
  room = merged as PaintRoom;
  roomsByType.set(type, room);
  return room;
}
