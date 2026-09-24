/**
 * The incremental changes to a TSCN scene.
 */

import type { TscnNode, TscnScene } from '../parser/types';

export type NodeChangeType = 'add' | 'remove' | 'update';

export interface NodeChange {
  type: NodeChangeType;
  nodePath: string;
  node?: TscnNode; // Required for 'add' and 'update' types
  parentPath?: string; // Required for 'add' type to know where to attach
}

export interface IncrementalUpdateData {
  changes: NodeChange[];
  sceneData: TscnScene; // Full scene data for resource resolution
}
