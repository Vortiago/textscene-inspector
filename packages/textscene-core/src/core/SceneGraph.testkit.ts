/** Builds a SceneGraph from a loose TscnScene shape, for tests that start from parsed nodes. */

import type { ExtResource, SubResource, TscnNode } from '../parser/types';
import { buildSceneGraph, type SceneGraph } from './SceneGraph';

export function createSceneGraphFromTscnScene(
  tscnScene: {
    nodes: TscnNode[];
    externalResources?: ExtResource[];
    internalResources?: SubResource[];
  },
  scenePath: string = 'res://test.tscn'
): SceneGraph {
  return buildSceneGraph({
    path: scenePath,
    nodes: tscnScene.nodes,
    internalResources: tscnScene.internalResources || [],
    externalResources: tscnScene.externalResources || [],
  });
}
