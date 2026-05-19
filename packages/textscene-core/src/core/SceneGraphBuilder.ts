/**
 * Builder for creating immutable SceneGraphs with Copy-on-Write semantics.
 * Use to create new SceneGraphs or update existing ones without mutation.
 */

import type {
  SceneGraph,
  ParsedScene,
  SceneNode,
} from './SceneGraph.js';
import type { TscnNode } from '../parser/types.js';

/**
 * Builder for creating immutable SceneGraphs with Copy-on-Write semantics.
 * Updates create new instances; old graphs remain unchanged.
 */
export class SceneGraphBuilder {
  private rootScene: string = '';
  private scenes = new Map<string, ParsedScene>();
  private baseVersion: number = 0;

  /**
   * Start from existing graph (Copy-on-Write).
   * The new graph will share unchanged data with the original.
   */
  from(graph: SceneGraph): SceneGraphBuilder {
    this.rootScene = graph.rootScene;
    // Shallow copy - ParsedScene objects are immutable, so sharing is safe
    this.scenes = new Map(graph.scenes);
    this.baseVersion = graph.version;
    return this;
  }

  /**
   * Set root scene path.
   */
  setRootScene(path: string): SceneGraphBuilder {
    this.rootScene = path;
    return this;
  }

  /**
   * Add scene to hierarchy.
   */
  addScene(scene: ParsedScene): SceneGraphBuilder {
    this.scenes.set(scene.path, scene);
    return this;
  }

  /**
   * Update existing scene (replaces old version).
   * @throws Error if scene doesn't exist
   */
  updateScene(path: string, scene: ParsedScene): SceneGraphBuilder {
    if (!this.scenes.has(path)) {
      throw new Error(`Scene not found: ${path}`);
    }
    this.scenes.set(path, scene);
    return this;
  }

  /**
   * Remove scene from hierarchy.
   */
  removeScene(path: string): SceneGraphBuilder {
    this.scenes.delete(path);
    return this;
  }

  /**
   * Build immutable SceneGraph.
   * Old graph (if any) remains unchanged.
   * @throws Error if root scene not set
   */
  build(): SceneGraph {
    if (!this.rootScene) {
      throw new Error('Root scene not set');
    }

    // Flatten all nodes from all scenes
    const flattenedNodes = this.flattenNodes();

    // Create immutable graph
    const graph: SceneGraph = {
      rootScene: this.rootScene,
      scenes: Object.freeze(new Map(this.scenes)) as ReadonlyMap<string, ParsedScene>,
      flattenedNodes: Object.freeze([...flattenedNodes]) as ReadonlyArray<SceneNode>,
      version: this.baseVersion + 1,
      timestamp: Date.now(),
    };

    // Freeze the top-level object
    return Object.freeze(graph);
  }

  /**
   * Flatten all scenes into single node array.
   * Produces nodes with full paths like "Main/Hallway/Door".
   */
  private flattenNodes(): SceneNode[] {
    const nodes: SceneNode[] = [];
    const rootScene = this.scenes.get(this.rootScene);

    if (rootScene) {
      this.flattenSceneNodes(rootScene, '', rootScene.path, nodes);
    }

    return nodes;
  }

  /**
   * Recursively flatten scene nodes with path tracking.
   */
  private flattenSceneNodes(
    scene: ParsedScene,
    parentPath: string,
    source: string,
    output: SceneNode[]
  ): void {
    // Initialize visited scenes with the source scene to protect against circular references
    const visitedScenes = new Set<string>([source]);
    for (const node of scene.nodes) {
      this.flattenNodeRecursive(node, parentPath, source, output, visitedScenes);
    }
  }

  /**
   * Recursively flatten a single node and its children.
   * Injects external scene nodes at instance points.
   * Tracks visited scene paths to prevent infinite recursion from circular references.
   */
  private flattenNodeRecursive(
    node: TscnNode,
    parentPath: string,
    source: string,
    output: SceneNode[],
    visitedScenes: Set<string> = new Set()
  ): void {
    const nodePath = parentPath ? `${parentPath}/${node.name}` : node.name;

    output.push({
      path: nodePath,
      name: node.name,
      data: node,
      source: source,
      parent: parentPath || null,
    });

    // Inject external scene nodes at instance point (skip GLBs - not in scenes map)
    if (node.instance) {
      const extScenePath = this.resolveInstancePath(node.instance, source);
      if (extScenePath) {
        // Circular reference protection: skip if we've already visited this scene in current path
        if (!visitedScenes.has(extScenePath)) {
          const extScene = this.scenes.get(extScenePath);
          if (extScene) {
            // Mark this scene as visited before recursing
            const newVisited = new Set(visitedScenes);
            newVisited.add(extScenePath);
            // Inject all external scene nodes as children of this instance node
            for (const extNode of extScene.nodes) {
              this.flattenNodeRecursive(extNode, nodePath, extScenePath, output, newVisited);
            }
          }
        }
        // If circular reference, we just skip injecting (node already added above)
      }
    }

    // Recurse for inline children (children defined in parent scene)
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.flattenNodeRecursive(child, nodePath, source, output, visitedScenes);
      }
    }
  }

  /**
   * Resolve an instance reference to its external scene path.
   * Only returns path for PackedScene types (ignores GLB/GLTF, Texture2D, etc.)
   */
  private resolveInstancePath(instanceRef: string, sourceScenePath: string): string | null {
    // Parse ExtResource("1_abc") format
    const match = instanceRef.match(/ExtResource\("([^"]+)"\)/);
    if (!match) return null;

    const id = match[1];
    const sourceScene = this.scenes.get(sourceScenePath);
    if (!sourceScene) return null;

    // Find matching external resource
    const resource = sourceScene.externalResources.find((r) => r.id === id);

    // Only resolve PackedScene types (skip GLB, textures, etc.)
    return resource?.type === 'PackedScene' ? resource.path : null;
  }

  /**
   * Get current scene count (for debugging).
   */
  getSceneCount(): number {
    return this.scenes.size;
  }

  /**
   * Check if a scene exists in the builder.
   */
  hasScene(path: string): boolean {
    return this.scenes.has(path);
  }
}
