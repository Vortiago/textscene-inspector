import type { SceneGraph } from '../core/SceneGraph.js';
import { nodeNotFound, SceneNodeHandle, type HandleHost, type NodeHandle } from './nodeHandle.js';
import { getNodeOrNull, ROOT_WINDOW_PATH, type WalkedTree } from './nodePathWalk.js';
import { loadPropertyAccess, type PropertyAccess, type SceneProperties } from './sceneProperties.js';
import type { SceneTree, SceneTreeNode } from './sceneRuntime.js';
import type { SceneValue } from './variant.js';
import { isWritable } from './writtenScene.js';
import {
  findPortedMethod,
  hasPortedMethods,
  runPortedMethod,
  type CallResult,
  type MethodTarget,
  type PortedMethod,
} from './nodeMethods.js';
import { memoisedImport } from '../resources/memoisedImport.js';
import { ViewportCameras } from './viewportCameras.js';
import type { PropertyMethod } from '../godot/classdb/propertyMethod.js';

/** The setter and getter names of every class are tens of kB, so they load on the first use. */
const loadPropertyMethods = memoisedImport(() => import('../godot/classdb/propertyMethod.js'));

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
  readonly cameras: ViewportCameras;

  constructor(
    private readonly source: SceneNodesSource,
    private readonly properties: SceneProperties,
    private readonly onWritten: (path: string) => void
  ) {
    this.cameras = new ViewportCameras(
      {
        cameras: () => this.source.tree()?.cameras() ?? null,
        enabledText: ({ path, rawProperties }) =>
          this.properties.writes().get(path)?.enabled ?? rawProperties.enabled,
      },
      (livePaths) => livePaths.forEach((livePath) => this.onWritten(absolutePathOf(livePath)))
    );
  }

  /** A new text frees every node. */
  clear(): void {
    this.handles.clear();
    this.properties.clear();
    this.cameras.reset();
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
    return found === null || this.typeOf(found, tree) === null ? null : this.handleAt(found);
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

  typeOf(path: string, tree = this.source.tree()): string | null {
    if (path === ROOT_WINDOW_PATH) return ROOT_WINDOW_TYPE;
    return this.nodeAt(path, tree)?.type ?? null;
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

  /** `Object::get`: a getter this release ports as a method runs it. */
  async get(path: string, property: string): Promise<SceneValue | null> {
    const accessor = await this.portedAccessor(path, property, 'getter');
    if (!accessor) return this.getStored(path, property);
    const { name, method } = accessor;
    return (await runPortedMethod(method, name, this.methodTarget(path), [])) as SceneValue | null;
  }

  /** `Object::set`: a setter this release ports as a method runs it. */
  async set(path: string, property: string, value: SceneValue): Promise<boolean> {
    const accessor = await this.portedAccessor(path, property, 'setter');
    if (!accessor) return this.setStored(path, property, value);
    await runPortedMethod(accessor.method, accessor.name, this.methodTarget(path), [value]);
    return true;
  }

  /** The ported setter or getter of `property`, if the node's class ports it. */
  private async portedAccessor(
    path: string,
    property: string,
    role: 'setter' | 'getter'
  ): Promise<{ name: string; method: PortedMethod } | undefined> {
    const type = this.typeOfNode(path);
    if (!hasPortedMethods(type)) return undefined;
    const name = (await loadPropertyMethods()).accessorOf(role, type, property);
    const method = name ? findPortedMethod(type, name) : undefined;
    return name && method ? { name, method } : undefined;
  }

  /** `Object::callv`: a ported method, else the property a setter or a getter reaches. */
  async call(path: string, method: string, args: readonly SceneValue[]): Promise<CallResult> {
    const type = this.typeOfNode(path);
    const ported = findPortedMethod(type, method);
    if (ported) return runPortedMethod(ported, method, this.methodTarget(path), args);
    const reached = (await loadPropertyMethods()).findPropertyMethod(type, method);
    if (!reached) {
      throw new Error(
        `expected a method this release ports, got "${method}" of ${type}: it ports the camera methods and the property setters and getters, and no other method`
      );
    }
    return this.callPropertyMethod(path, method, reached, args);
  }

  /** A setter or a getter: an indexed one takes the index first (`class_db.cpp:1667-1673`). */
  private async callPropertyMethod(
    path: string,
    method: string,
    { role, properties }: PropertyMethod,
    args: readonly SceneValue[]
  ): Promise<CallResult> {
    const isIndexed = !properties.has(null);
    const index = isIndexed ? args[0] : null;
    const values = isIndexed ? args.slice(1) : args;
    const property = properties.get(index as number | null);
    if (property === undefined) {
      throw new Error(
        `expected one of the indexes ${[...properties.keys()].join(', ')} for ${method}, got ${String(index)}`
      );
    }
    const valueCount = role === 'setter' ? 1 : 0;
    if (values.length !== valueCount) {
      throw new Error(
        `expected ${valueCount + Number(isIndexed)} arguments for ${method}, got ${args.length}`
      );
    }
    if (role === 'getter') return this.get(path, property);
    await this.set(path, property, values[0]!);
    return null;
  }

  private async getStored(path: string, property: string): Promise<SceneValue | null> {
    const { access, node } = await this.propertyTarget(path);
    return this.properties.get(access, livePathOf(path), node, property);
  }

  private async setStored(path: string, property: string, value: SceneValue): Promise<boolean> {
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

  private methodTarget(path: string): MethodTarget {
    return {
      livePath: path === ROOT_WINDOW_PATH ? null : livePathOf(path),
      cameras: this.cameras,
      readStored: (property) => this.getStored(path, property),
      writeStored: (property, value) => this.setStored(path, property, value),
      handleAt: (livePath) => this.handleAt(absolutePathOf(livePath)),
    };
  }

  /** The class of the node at `path`, which a handle reached inside the tree. */
  private typeOfNode(path: string): string {
    const type = this.typeOf(path);
    if (type === null)
      throw new Error(`expected a node inside the tree at ${path}, found it freed by a new text`);
    return type;
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

  /** One walk reads one tree: building the Live scene tree per step makes a deep lookup quadratic. */
  private nodeAt(path: string, tree = this.source.tree()): SceneTreeNode | null {
    if (!path.startsWith(ROOT_WINDOW_PREFIX)) return null;
    return tree?.node(livePathOf(path)) ?? null;
  }

  private childNames(path: string, tree = this.source.tree()): readonly string[] | null {
    if (path === ROOT_WINDOW_PATH) {
      const root = this.rootPath();
      return root ? [livePathOf(root)] : [];
    }
    return this.nodeAt(path, tree)?.childNames ?? null;
  }

  private walkedTree(tree: SceneTree): WalkedTree {
    return {
      childNames: (path) => this.childNames(path, tree),
      uniquePaths: (path) => {
        if (!path.startsWith(ROOT_WINDOW_PREFIX)) return new Map();
        const live = tree.uniquePaths(livePathOf(path));
        return new Map([...live].map(([name, livePath]) => [name, absolutePathOf(livePath)]));
      },
    };
  }
}
