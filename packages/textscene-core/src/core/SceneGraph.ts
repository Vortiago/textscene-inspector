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
  /** External scene references (instances) */
  readonly externalScenes: ReadonlyArray<ExternalSceneRef>;
  /** Internal resource definitions, such as embedded materials and meshes. */
  readonly internalResources: ReadonlyArray<SubResource>;
  /** External resource references, such as textures and materials. */
  readonly externalResources: ReadonlyArray<ExtResource>;
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

/**
 * External scene reference (before/after resolution).
 * Tracks the status of external scene instances.
 */
export interface ExternalSceneRef {
  /** Node name for this instance in parent scene */
  readonly nodeName: string;
  /** Path to external scene file, such as "res://enemy.tscn". */
  readonly scenePath: string;
  /** Resolved scene data (if loaded) */
  readonly resolvedScene?: ParsedScene;
  readonly resolutionStatus: 'pending' | 'resolved' | 'failed';
}


/** Wrap a TscnScene's parts in a ParsedScene, without copying them. */
export function tscnSceneToParsedScene(
  path: string,
  nodes: TscnNode[],
  externalResources: ExtResource[],
  internalResources: SubResource[],
  externalScenes: ExternalSceneRef[] = []
): ParsedScene {
  return {
    path,
    nodes,
    externalScenes,
    internalResources,
    externalResources,
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

/**
 * Create a SceneGraph from a TscnScene (for tests and simple use cases).
 * Thin adapter that wraps the loose TscnScene shape in a ParsedScene and
 * delegates to {@link buildSceneGraph}.
 */
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
    externalScenes: [],
    internalResources: tscnScene.internalResources || [],
    externalResources: tscnScene.externalResources || [],
  });
}
