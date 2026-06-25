/**
 * Builder for assembling the immutable single-scene SceneGraph the renderer consumes.
 *
 * Only the authored root scene is composed here. PackedScene instance
 * composition (folding sub-scenes into the tree) is owned by the live scene
 * tree (`r3f/liveSceneTree.ts`), not this builder — see ADR-0013. The builder
 * therefore holds a single ParsedScene and flattens its inline nodes.
 */

import type {
  SceneGraph,
  ParsedScene,
  SceneNode,
} from './SceneGraph.js';
import type { TscnNode } from '../parser/types.js';

export class SceneGraphBuilder {
  private rootScene: string = '';
  private scenes = new Map<string, ParsedScene>();

  /**
   * Set root scene path.
   */
  setRootScene(path: string): SceneGraphBuilder {
    this.rootScene = path;
    return this;
  }

  /**
   * Add the scene to build.
   */
  addScene(scene: ParsedScene): SceneGraphBuilder {
    this.scenes.set(scene.path, scene);
    return this;
  }

  /**
   * Build immutable SceneGraph.
   * @throws Error if root scene not set
   */
  build(): SceneGraph {
    if (!this.rootScene) {
      throw new Error('Root scene not set');
    }

    const graph: SceneGraph = {
      rootScene: this.rootScene,
      scenes: Object.freeze(new Map(this.scenes)) as ReadonlyMap<string, ParsedScene>,
      flattenedNodes: Object.freeze(this.flattenNodes()) as ReadonlyArray<SceneNode>,
    };

    return Object.freeze(graph);
  }

  /**
   * Flatten the root scene's nodes into a single array with full paths
   * like "Main/Hallway/Door".
   */
  private flattenNodes(): SceneNode[] {
    const nodes: SceneNode[] = [];
    const rootScene = this.scenes.get(this.rootScene);

    if (rootScene) {
      for (const node of rootScene.nodes) {
        this.flattenNode(node, null, rootScene.path, nodes);
      }
    }

    return nodes;
  }

  /**
   * Recursively flatten a single node and its inline children with path tracking.
   */
  private flattenNode(
    node: TscnNode,
    parentPath: string | null,
    source: string,
    output: SceneNode[]
  ): void {
    const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;

    output.push({
      path: nodePath,
      name: node.name,
      data: node,
      source,
      parent: parentPath,
    });

    if (node.children) {
      for (const child of node.children) {
        this.flattenNode(child, nodePath, source, output);
      }
    }
  }
}
