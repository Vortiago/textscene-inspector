/**
 * Immutable scene graph data structures.
 * Once created, never modified; buildSceneGraph assembles a fresh graph per parse.
 */

import type { TscnNode, ExtResource, SubResource } from '../parser/types.js';

/** Immutable scene graph for one authored root scene. */
export interface SceneGraph {
  /** Root scene path, such as "res://main.tscn". */
  readonly rootScene: string;
  /** The authored root scene, keyed by path: one entry. liveSceneTree composes PackedScene instances (ADR-0013). */
  readonly scenes: ReadonlyMap<string, ParsedScene>;
  /** All nodes flattened into single array with full paths */
  readonly flattenedNodes: ReadonlyArray<SceneNode>;
}

/**
 * Parsed scene (immutable).
 * Represents a single .tscn file's contents.
 */
export interface ParsedScene {
  /** Scene file path, such as "res://door.tscn". */
  readonly path: string;
  /** Root nodes in this scene (original TSCN nodes, not mutated) */
  readonly nodes: ReadonlyArray<TscnNode>;
  /** Internal resource definitions, such as embedded materials and meshes. */
  readonly internalResources: ReadonlyArray<SubResource>;
  /** External resource references, such as textures and materials. */
  readonly externalResources: ReadonlyArray<ExtResource>;
  /** The `[editable]` paths of this scene's file, root-relative. Absent where it has none. */
  readonly editableInstances?: ReadonlyArray<string>;
}

/**
 * Scene node with full path and source tracking.
 * Represents a flattened view of the scene hierarchy.
 */
export interface SceneNode {
  /** Full path in hierarchy, such as "Main/Hallway/Door". */
  readonly path: string;
  readonly name: string;
  /** Original TSCN node data (not mutated) */
  readonly data: TscnNode;
  /** Source scene file path, such as "res://door.tscn". */
  readonly source: string;
  /** Parent node path (null for root nodes) */
  readonly parent: string | null;
}

/** Wrap a TscnScene's parts in a ParsedScene, without copying them. */
export function tscnSceneToParsedScene(
  path: string,
  nodes: TscnNode[],
  externalResources: ExtResource[],
  internalResources: SubResource[],
  editableInstances?: readonly string[]
): ParsedScene {
  return {
    path,
    nodes,
    internalResources,
    externalResources,
    ...(editableInstances ? { editableInstances } : {}),
  };
}

/**
 * Assemble the immutable single-scene SceneGraph the renderer consumes: flatten the root
 * scene's inline nodes with full paths and parent links, and freeze the graph, its scenes map
 * and its nodes. The live scene tree (`r3f/liveSceneTree.ts`) composes instances (ADR-0013).
 */
export function buildSceneGraph(rootScene: ParsedScene): SceneGraph {
  const flattenedNodes: SceneNode[] = [];
  function flattenNode(node: TscnNode, parentPath: string | null): void {
    const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;
    flattenedNodes.push({
      path: nodePath,
      name: node.name,
      data: node,
      source: rootScene.path,
      parent: parentPath,
    });
    for (const child of node.children) {
      flattenNode(child, nodePath);
    }
  }

  for (const node of rootScene.nodes) {
    flattenNode(node, null);
  }

  return Object.freeze({
    rootScene: rootScene.path,
    scenes: Object.freeze(new Map([[rootScene.path, rootScene]])) as ReadonlyMap<string, ParsedScene>,
    flattenedNodes: Object.freeze(flattenedNodes) as ReadonlyArray<SceneNode>,
  });
}
