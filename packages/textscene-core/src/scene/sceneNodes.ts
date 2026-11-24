import type { SceneGraph } from '../core/SceneGraph.js';
import { nodeNotFound, SceneNodeHandle, type HandleHost, type NodeHandle } from './nodeHandle.js';
import {
  absolutePathOf,
  getNodeOrNull,
  livePathOf,
  ROOT_WINDOW_PATH,
  ROOT_WINDOW_PREFIX,
  type WalkedTree,
} from './nodePathWalk.js';
import { loadPropertyAccess, type PropertyAccess, type SceneProperties } from './sceneProperties.js';
import type { SceneTree, SceneTreeNode } from './sceneRuntime.js';
import { sceneValueOf, valueOfSceneValue, variantOf, type SceneValue } from './variant.js';
import { VARIANT_TYPE as T } from '../godot/variant/variantType.js';
import { strToVar } from '../godot/variant/strToVar.js';
import { projectViewportSize } from '../parser/projectSettingsParser.js';
import { isWritable } from './writtenScene.js';
import {
  argumentCountError,
  findPortedMethod,
  PORTED_METHOD_NAMES,
  findPortedAccessor,
  intArgument,
  runPortedMethod,
  valueArguments,
  type CallArgument,
  type CallResult,
  type MethodTarget,
} from './nodeMethods.js';
import { memoisedImport } from '../resources/memoisedImport.js';
import { ViewportCameras } from './viewportCameras.js';
import type { PropertyMethod } from '../godot/classdb/propertyMethod.js';

/** The setter and getter names of every class are tens of kB, so they load on the first use. */
const loadPropertyMethods = memoisedImport(() => import('../godot/classdb/propertyMethod.js'));

/** `get_class` of the root viewport, the window above the scene's root node. */
const ROOT_WINDOW_TYPE = 'Window';

/** The properties whose write changes the shape of the tree, which this release does not port. */
const SHAPE_PROPERTIES: ReadonlySet<string> = new Set(['script', 'instance', 'name']);

/** What the nodes read of their scene: its parse and the Live scene tree over it. */
export interface SceneNodesSource {
  graph(): SceneGraph | null;
  /** Null with no parse. */
  tree(): SceneTree | null;
  /** The class `load` gives for the resource at `path`, or null where it reads none. */
  resourceClass(path: string): Promise<string | null>;
}

/** The nodes of one text of the scene, each named by its absolute path. */
export class SceneNodes implements HandleHost {
  /** Written only by `handleAt` and `clear`: one handle for each node, so two lookups give one. */
  private readonly handles = new Map<string, NodeHandle>();
  /** Written only by `clear`: moves with each new text, so a write that waited on the load lands nowhere. */
  private generation = 0;
  /** Written only by `inWriteOrder`: the class read of the latest `set`, which the next one waits on. */
  private latestClassRead: Promise<unknown> = Promise.resolve();
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

  /** As `find`, a child whose scene has not loaded is no node yet. */
  childPaths(path: string): readonly string[] {
    const tree = this.source.tree();
    return (this.childNames(path) ?? [])
      .map((name) => `${path}/${name}`)
      .filter((child) => this.typeOf(child, tree) !== null);
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
    const generation = this.generation;
    const accessor = findPortedAccessor(this.typeOfNode(path), 'getter', property);
    if (!accessor && path === ROOT_WINDOW_PATH) return this.rootWindowProperty(property);
    if (!accessor) return this.getStored(path, property);
    const { name, method } = accessor;
    const target = this.methodTarget(path, generation);
    return (await runPortedMethod(
      method,
      `${this.typeOfNode(path)}::${name}`,
      target,
      []
    )) as SceneValue | null;
  }

  /** The root window answers only `content_scale_size`, Godot's default until the settings load. */
  private rootWindowProperty(property: string): SceneValue {
    if (property !== 'content_scale_size') {
      throw new Error(
        `expected content_scale_size of the root window, got ${property}: its other properties are not in this release`
      );
    }
    const { width, height } = this.source.tree()?.contentScaleSize ?? projectViewportSize(null);
    return variantOf({ type: T.VECTOR2I, value: [width, height] });
  }

  /** `Object::set`: a setter this release ports as a method runs it. */
  async set(path: string, property: string, written: SceneValue): Promise<boolean> {
    const generation = this.generation;
    const value = await this.inWriteOrder(this.withResourceClass(written));
    this.assertSameText(generation, path);
    const accessor = findPortedAccessor(this.typeOfNode(path), 'setter', property);
    if (!accessor) return this.setStored(path, property, value);
    // `Object::set` casts as `VariantCaster` does, and reports the call valid only for a strict cast.
    const { access } = await this.propertyTarget(path);
    const cast = access.castForSetter(this.typeOfNode(path), property, valueOfSceneValue(value));
    const target = this.methodTarget(path, generation);
    await runPortedMethod(accessor.method, `${this.typeOfNode(path)}::${accessor.name}`, target, [
      sceneValueOf(cast.value),
    ]);
    return cast.isValid;
  }

  /** A class read waits on the host's files, so each `set` waits on the one before: the last write wins. */
  private inWriteOrder(classRead: Promise<SceneValue>): Promise<SceneValue> {
    const ordered = this.latestClassRead.then(() => classRead);
    // The caller's `set` rejects with the error. The next write still runs.
    this.latestClassRead = ordered.catch(() => undefined);
    return ordered;
  }

  /** `str_to_var` loads the resource a text names, so a setter's `Ref<T>` check reads its class. */
  private async withResourceClass(value: SceneValue): Promise<SceneValue> {
    const variant = valueOfSceneValue(value);
    if (variant.type !== T.OBJECT || !variant.resource || variant.className) return value;
    const className = await this.source.resourceClass(variant.resource.path);
    return className ? variantOf({ ...variant, className }) : value;
  }

  /** `Object::callv`: a ported method, else the property a setter or a getter reaches. */
  async call(path: string, method: string, args: readonly CallArgument[]): Promise<CallResult> {
    const generation = this.generation;
    const type = this.typeOfNode(path);
    const ported = findPortedMethod(type, method);
    const name = `${type}::${method}`;
    if (ported) return runPortedMethod(ported, name, this.methodTarget(path, generation), args);
    const methods = await loadPropertyMethods();
    this.assertSameText(generation, path);
    const reached = methods.findPropertyMethod(type, method);
    if (!reached) {
      throw new Error(
        `${name}: not a method this release ports. It ports ${PORTED_METHOD_NAMES.join(', ')}, and the property setters and getters.`
      );
    }
    return this.callPropertyMethod(path, name, reached, args);
  }

  /** A setter or a getter: an indexed one takes the index first (`class_db.cpp:1667-1673`). */
  private async callPropertyMethod(
    path: string,
    method: string,
    { role, properties }: PropertyMethod,
    called: readonly CallArgument[]
  ): Promise<CallResult> {
    const isIndexed = !properties.has(null);
    const argumentCount = Number(isIndexed) + (role === 'setter' ? 1 : 0);
    // The count is checked before the index, as a bound call checks it first (`method_bind.h`).
    if (called.length !== argumentCount) throw argumentCountError(method, argumentCount, called.length);
    const args = valueArguments(called, method);
    const index = isIndexed ? intArgument(args[0]!, method) : null;
    const values = isIndexed ? args.slice(1) : args;
    const property = properties.get(index);
    if (property === undefined) {
      throw new Error(
        `expected one of the indexes ${[...properties.keys()].join(', ')} for ${method}, got ${String(index)}`
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

  /** A target that refuses each step once a new text has freed the node the call began on. */
  private methodTarget(path: string, generation: number): MethodTarget {
    return {
      className: this.typeOfNode(path),
      livePath: path === ROOT_WINDOW_PATH ? null : livePathOf(path),
      cameras: () => {
        this.assertSameText(generation, path);
        return this.cameras;
      },
      readStored: (property) => {
        this.assertSameText(generation, path);
        return this.getStored(path, property);
      },
      writeStored: (property, value) => {
        this.assertSameText(generation, path);
        return this.setStored(path, property, value);
      },
      handleAt: (livePath) => this.handleAt(absolutePathOf(livePath)),
      sceneFilePath: () => this.treeNodeOf(path, generation)?.sceneFilePath ?? '',
      ownerPath: () => this.treeNodeOf(path, generation)?.ownerPath() ?? null,
      isEditableInstance: (node) => {
        this.assertSameText(generation, path);
        return this.handles.get(node.path) === node && node.isInsideTree()
          ? (this.treeNodeOf(node.path, generation)?.isEditableInstance() ?? false)
          : false;
      },
      ownTexts: async () => {
        const { access, node } = await this.propertyTarget(path);
        this.assertSameText(generation, path);
        const reading = { classExists: access.classExists, resourceOf: node.resourceOf.bind(node) };
        const texts = Object.entries(node.rawProperties).map(
          ([key, text]) => [key, strToVar(text, reading)] as const
        );
        return { texts, resourceClass: (resourcePath) => this.source.resourceClass(resourcePath) };
      },
    };
  }

  /** The node's tree entry in the text the call began in, null for the root window. */
  private treeNodeOf(path: string, generation: number): SceneTreeNode | null {
    this.assertSameText(generation, path);
    return path === ROOT_WINDOW_PATH ? null : this.nodeAt(path);
  }

  /** A call that awaited still acts on the text it began in, never on a node of a newer text. */
  private assertSameText(generation: number, path: string): void {
    if (generation !== this.generation)
      throw new Error(`expected a node inside the tree at ${path}, found it freed by a new text`);
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
