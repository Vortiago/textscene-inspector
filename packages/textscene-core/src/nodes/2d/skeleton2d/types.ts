/** The Skeleton2D property shape: a Node2D with the stack of modifications it runs on its bones. */

import type { Node2DProperties } from '../../base/node2d/types';

export interface Skeleton2DProperties extends Node2DProperties {
  /** The raw `modification_stack` reference, for `useBoundStack` to resolve. */
  modificationStack: string | undefined;
}
