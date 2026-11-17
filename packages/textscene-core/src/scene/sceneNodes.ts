import type { SceneGraph } from '../core/SceneGraph.js';
import { nodeNotFound, SceneNodeHandle, type HandleHost, type NodeHandle } from './nodeHandle.js';
import { getNodeOrNull, ROOT_WINDOW_PATH, type WalkedTree } from './nodePathWalk.js';
import { loadPropertyAccess, type PropertyAccess, type SceneProperties } from './sceneProperties.js';
import type { SceneTree, SceneTreeNode } from './sceneRuntime.js';
import type { SceneValue } from './variant.js';
import { isWritable } from './writtenScene.js';

/** `get_class` of the root viewport, the window above the scene's root node. */
const ROOT_WINDOW_TYPE = 'Window';
const ROOT_WINDOW_PREFIX = `${ROOT_WINDOW_PATH}/`;

/** The properties whose write changes the shape of the tree, which this release does not port. */
const SHAPE_PROPERTIES: ReadonlySet<string> = new Set(['script', 'instance', 'name']);

function livePathOf(path: string): string {
  return path.slice(ROOT_WINDOW_PREFIX.length);
}

function absolutePathOf(livePath: string): string {
  return `${ROOT_WINDOW_PREFIX}${livePath}`;
}

/** What the nodes read of their scene: its parse and the Live scene tree over it. */
export interface SceneNodesSource {
  graph(): SceneGraph | null;
  /** Null with no parse. */
  tree(): SceneTree | null;
}

/** The nodes of one text of the scene, each named by its absolute path. */
export class SceneNodes implements HandleHost {
  /** Written only by `handleAt` and `clear`: one handle for each node, so two lookups give one. */
  private readonly handles = new Map<string, NodeHandle>();
  /** Written only by `clear`: moves with each new text, so a write that waited on the load lands nowhere. */
  private generation = 0;

  constructor(
    private readonly source: SceneNodesSource,
    private readonly properties: SceneProperties,
    private readonly onWritten: (path: string) => void
  ) {}

  /** A new text frees every node. */
  clear(): void {
    this.handles.clear();
    this.properties.clear();
    this.generation++;
  }

  /** The absolute path of the scene's root node, or null with no parse. */
  rootPath(): string | null {
    const graph = this.source.graph();
    const root = graph?.scenes.get(graph.rootScene)?.nodes[0];
    return root ? absolutePathOf(root.name) : null;
  }

  find(from: string, path: string): NodeHandle | null {
    const tree = this.source.tree();
    if (!tree) return null;
    const found = getNodeOrNull(this.walkedTree(tree), from, path);
    // A child whose scene has not loaded is listed by its parent, but Godot has no node there yet.
    return found === null || this.typeOf(found) === null ? null : this.handleAt(found);
  }

  /** `get_node` from the scene's root node. */
  getNode(path: string): NodeHandle {
    const found = this.getNodeOrNull(path);
    if (!found) throw nodeNotFound(this.rootPath() ?? ROOT_WINDOW_PATH, path);
    return found;
  }

  getNodeOrNull(path: string): NodeHandle | null {
    const root = this.rootPath();
    return root ? this.find(root, path) : null;
  }

  typeOf(path: string): string | null {
    if (path === ROOT_WINDOW_PATH) return ROOT_WINDOW_TYPE;
    return this.nodeAt(path)?.type ?? null;
  }

  childPaths(path: string): readonly string[] {
    return (this.childNames(path) ?? []).map((name) => `${path}/${name}`);
  }

  handleAt(path: string): NodeHandle {
    let handle = this.handles.get(path);
    const type = this.typeOf(path);
    if (type === null) throw new Error(`expected a node at ${path}, found none in the loaded tree`);
    if (!handle || handle.type !== type) {
      handle = new SceneNodeHandle(this, path, type);
      this.handles.set(path, handle);
    }
    return handle;
  }

  async get(path: string, property: string): Promise<SceneValue | null> {
    const { access, node } = await this.propertyTarget(path);
    return this.properties.get(access, livePathOf(path), node, property);
  }

  async set(path: string, property: string, value: SceneValue): Promise<boolean> {
    if (SHAPE_PROPERTIES.has(property)) {
      throw new Error(
        `expected a property that keeps the tree's shape, got "${property}": a write of it is not in this release`
      );
    }
    const { access, node } = await this.propertyTarget(path);
    const graph = this.source.graph();
    if (!graph || !isWritable(graph, livePathOf(path))) {
      throw new Error(
        `expected a node the scene file reaches, got ${path}: no heading of the file can hold a write to it`
      );
    }
    const before = this.properties.writes();
    const isValid = this.properties.set(access, livePathOf(path), node, property, value);
    if (this.properties.writes() !== before) this.onWritten(path);
    return isValid;
  }

  /** The class table, once loaded, and the node at `path`, still in the text the call was made in. */
  private async propertyTarget(path: string): Promise<{ access: PropertyAccess; node: SceneTreeNode }> {
    if (path === ROOT_WINDOW_PATH) {
      throw new Error(
        `expected a node of the scene, got the root window: its properties are not in this release`
      );
    }
    const generation = this.generation;
    const access = await loadPropertyAccess();
    const node = generation === this.generation ? this.nodeAt(path) : null;
    if (!node) throw new Error(`expected a node inside the tree at ${path}, found it freed by a new text`);
    return { access, node };
  }

  private nodeAt(path: string): SceneTreeNode | null {
    if (!path.startsWith(ROOT_WINDOW_PREFIX)) return null;
    return this.source.tree()?.node(livePathOf(path)) ?? null;
  }

  private childNames(path: string): readonly string[] | null {
    if (path === ROOT_WINDOW_PATH) {
      const root = this.rootPath();
      return root ? [livePathOf(root)] : [];
    }
    return this.nodeAt(path)?.childNames ?? null;
  }

  private walkedTree(tree: SceneTree): WalkedTree {
    return {
      childNames: (path) => this.childNames(path),
      uniquePaths: (path) => {
        if (!path.startsWith(ROOT_WINDOW_PREFIX)) return new Map();
        const live = tree.uniquePaths(livePathOf(path));
        return new Map([...live].map(([name, livePath]) => [name, absolutePathOf(livePath)]));
      },
    };
  }
}
