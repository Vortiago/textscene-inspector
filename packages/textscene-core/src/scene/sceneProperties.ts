import type { ParsedScene } from '../core/SceneGraph.js';
import type { TscnExternalResource } from '../parser/types.js';
import { varToStr } from '../godot/variant/varToStr.js';
import { VARIANT_TYPE as T } from '../godot/variant/variantType.js';
import type { ResourceReference, VariantValue } from '../godot/variant/variantValue.js';
import * as logger from '../logger.js';
import { findSubResource } from '../resources/SubResourceResolver.js';
import { parseSubResourcePath, subResourcePath } from '../resources/subResourcePath.js';
import type { DerivedProperties, NodeReader, NodeReads } from './derived/derivedProperty.js';
import type { ListedReads } from './listed/listedProperties.js';
import type { ContainerVisibility, SceneTreeNode } from './sceneRuntime.js';
import { WriteStore, type SceneWrites } from './sceneWrites.js';
import { sceneValueOf, valueOfSceneValue, type SceneValue } from './variant.js';

/** The class table and the defaults: hundreds of kB, so they load on the first `get` or `set`. */
export type PropertyAccess = typeof import('./propertyAccess.js');

export function loadPropertyAccess(): Promise<PropertyAccess> {
  return import('./propertyAccess.js');
}

/** The id prefix of a file `scene.load` gave, which no Godot-written id starts with. */
const LOADED_ID_PREFIX = 'textscene_load_';

/** The host's reads and writes of the properties of the scene's nodes, by live path. */
export class SceneProperties {
  private readonly store = new WriteStore();
  /** Written only by `derivedAt`, keyed by live path with its class, since a load can seat another class. */
  private readonly derived = new Map<string, { type: string; properties: DerivedProperties | null }>();
  /** Written only by `unknownProperty`: each name warned of, once for the scene's life. */
  private readonly warned = new Set<string>();
  /** Written only by `resourceText`: the files a write names, by path. */
  private readonly loaded = new Map<string, TscnExternalResource>();
  /** Written only by `resourceText` and `clear`: `loaded` as the written graph adds it. */
  private loadedList: readonly TscnExternalResource[] = [];

  constructor(
    private readonly rootScenePath: string,
    private readonly rootScene: () => ParsedScene | undefined,
    private readonly treeNode: (livePath: string) => SceneTreeNode | null,
    /** The node in the written scene's tree, where a container's sort and a live pass read the writes. */
    private readonly writtenTreeNode: (livePath: string) => SceneTreeNode | null,
    /** The resource a path names, as a class's `_get` loads it. */
    private readonly resource: ListedReads['resource']
  ) {}

  writes(): SceneWrites {
    return this.store.current();
  }

  /** The files the writes name, which the written graph adds to the root scene's own. */
  resources(): readonly TscnExternalResource[] {
    return this.loadedList;
  }

  clear(): void {
    this.store.clear();
    this.derived.clear();
    this.loaded.clear();
    this.loadedList = [];
  }

  async get(
    access: PropertyAccess,
    livePath: string,
    node: SceneTreeNode,
    property: string
  ): Promise<SceneValue | null> {
    const derived = this.derivedAt(access, livePath, node);
    const reads = this.readsAt(access, livePath, node);
    const outcome = await access.resolveGet(node, property, derived, reads, this.resource);
    if (outcome.kind === 'unknown') return this.unknownProperty(node, property, null);
    if (outcome.kind === 'refused') return null;
    if (outcome.kind === 'unported') throw unportedProperty(property, outcome.declaredBy);
    return sceneValueOf(this.sortedValue(livePath, property) ?? outcome.value);
  }

  /** Whether Godot reports the write valid. A write it drops leaves the writes as they were. */
  set(
    access: PropertyAccess,
    livePath: string,
    node: SceneTreeNode,
    property: string,
    value: SceneValue
  ): boolean {
    const variant = valueOfSceneValue(value);
    const derived = this.derivedAt(access, livePath, node);
    const outcome = access.resolveSet(node, property, variant, derived, this.readsAt(access, livePath, node));
    if (outcome.kind === 'unknown') return this.unknownProperty(node, property, false);
    if (outcome.kind === 'unported') throw unportedProperty(property, outcome.declaredBy);
    if (outcome.kind === 'dropped') return false;
    const held = this.containerHold(livePath, property);
    const ownVisible = outcome.writes.find(([stored]) => stored === 'visible')?.[1];
    if (held && ownVisible?.type === T.BOOL) return this.writeContainer(held, ownVisible.value);
    // A setter that refuses the value writes nothing, so the writes and their views stay as they were.
    if (outcome.writes.length === 0) return outcome.isValid;
    const texts = outcome.writes.map(([stored, written]) => [stored, this.textOf(written)] as const);
    this.store.write('host', livePath, texts);
    // A derived setter keeps its own cache: only a write of the stored property itself resets it.
    if (outcome.writes.some(([stored]) => stored === property)) derived?.storedWritten?.(property);
    return outcome.isValid;
  }

  /** The value a container's sort resolves, over the stored one: a page's `visible`, a `current_tab`. */
  private sortedValue(livePath: string, property: string): VariantValue | undefined {
    const node = this.writtenTreeNode(livePath);
    const held = property === 'visible' ? node?.containerVisibility : null;
    return held ? { type: T.BOOL, value: held.visible } : node?.sortedProperty(property);
  }

  /** The container's hold on the node's `visible`, which its sort writes over the node's own. */
  private containerHold(livePath: string, property: string): ContainerVisibility | null {
    return property === 'visible' ? (this.writtenTreeNode(livePath)?.containerVisibility ?? null) : null;
  }

  /** The child's write queues the sort, which writes the child's value back (`container.cpp:33-36`). */
  private writeContainer(held: ContainerVisibility, visible: boolean): boolean {
    const writes = held.writesFor(visible);
    if (writes.length > 0) {
      this.store.write(
        'host',
        held.containerPath,
        writes.map(([stored, value]) => [stored, this.textOf(value)] as const)
      );
    }
    return true;
  }

  private derivedAt(access: PropertyAccess, livePath: string, node: SceneTreeNode): DerivedProperties | null {
    const cached = this.derived.get(livePath);
    if (cached?.type === node.type) return cached.properties;
    const properties = access.derivedPropertiesOf(node.type);
    this.derived.set(livePath, { type: node.type, properties });
    return properties;
  }

  private readsAt(access: PropertyAccess, livePath: string, node: SceneTreeNode): NodeReads {
    return {
      stored: this.stored(access, livePath, node),
      parent: () => this.parentReader(access, livePath),
    };
  }

  /** The node above `livePath`, or null above the scene's root node. */
  private parentReader(access: PropertyAccess, livePath: string): NodeReader | null {
    const slash = livePath.lastIndexOf('/');
    if (slash < 0) return null;
    const parentPath = livePath.slice(0, slash);
    const parent = this.treeNode(parentPath);
    return parent && this.readerAt(access, parentPath, parent);
  }

  /** A node's ClassDB and derived properties as `get` answers them, undefined for any other name. */
  private readerAt(access: PropertyAccess, livePath: string, node: SceneTreeNode): NodeReader {
    return {
      type: node.type,
      get: (property) => {
        const derived = this.derivedAt(access, livePath, node);
        const reads = this.readsAt(access, livePath, node);
        const outcome = access.resolveClassGet(node, property, derived, reads);
        return outcome.kind === 'value' ? outcome.value : undefined;
      },
      parent: () => this.parentReader(access, livePath),
    };
  }

  private stored(access: PropertyAccess, livePath: string, node: SceneTreeNode) {
    const classExists = access.classExists;
    return access.storedValueOf({
      node,
      written: this.writes().get(livePath) ?? {},
      nodeReading: { classExists, resourceOf: (kind, id) => node.resourceOf(kind, id) },
      writtenReading: { classExists, resourceOf: (kind, id) => this.rootResourceOf(kind, id) },
      placedProperty: (property) => this.writtenTreeNode(livePath)?.placedProperty(property),
    });
  }

  /** `Object::set` of an unknown name reports it invalid and changes nothing; the scene warns once a name. */
  private unknownProperty<T>(node: SceneTreeNode, property: string, answer: T): T {
    if (!this.warned.has(property)) {
      this.warned.add(property);
      logger.warn(`expected a property of ${node.type}, got "${property}": the class has no such property`);
    }
    return answer;
  }

  /** The class of the root scene's sub-resource that `path` names, or null for any other path. */
  subResourceClass(path: string): string | null {
    const { filePath, subResourceId } = parseSubResourcePath(path);
    if (subResourceId === undefined || filePath !== this.rootScenePath) return null;
    const scene = this.rootScene();
    return (scene && findSubResource(scene.internalResources, subResourceId)?.type) ?? null;
  }

  /** The resource an id of the host's writes names: a file `scene.load` gave, else one of the root scene. */
  private rootResourceOf(kind: 'ExtResource' | 'SubResource', id: string): ResourceReference | null {
    if (kind === 'SubResource') return { path: subResourcePath(this.rootScenePath, id) };
    const ext =
      [...this.loaded.values()].find((loaded) => loaded.id === id) ??
      this.rootScene()?.externalResources.find((resource) => resource.id === id);
    return ext ? { path: ext.path } : null;
  }

  private textOf(value: VariantValue): string {
    if (value.type !== T.OBJECT || !value.resource) return varToStr(value);
    return this.resourceText(value.resource, value.className);
  }

  /** A resource as an id of the root scene, which the parser of the written heading reads. */
  private resourceText({ path }: ResourceReference, className: string | undefined): string {
    const { filePath, subResourceId } = parseSubResourcePath(path);
    if (subResourceId !== undefined) {
      if (filePath === this.rootScenePath) return `SubResource("${subResourceId}")`;
      throw new Error(
        `expected a resource of ${this.rootScenePath} or a file, got ${path}: a write of another scene's sub-resource is not in this release`
      );
    }
    let ext = this.loaded.get(path);
    if (!ext) {
      ext = { id: `${LOADED_ID_PREFIX}${this.loaded.size + 1}`, path, type: className ?? 'Resource' };
      this.loaded.set(path, ext);
      this.loadedList = [...this.loaded.values()];
    }
    return `ExtResource("${ext.id}")`;
  }
}

function unportedProperty(property: string, declaredBy: string): Error {
  return new Error(
    `expected a ported property, got "${property}" of ${declaredBy}: this release has no port of its setter or getter, or of a value it reads up the tree`
  );
}
