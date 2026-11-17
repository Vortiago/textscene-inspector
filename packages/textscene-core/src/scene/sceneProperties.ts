import type { ParsedScene } from '../core/SceneGraph.js';
import type { TscnExternalResource } from '../parser/types.js';
import { varToStr } from '../godot/variant/varToStr.js';
import { VARIANT_TYPE as T } from '../godot/variant/variantType.js';
import type { ResourceReference, VariantValue } from '../godot/variant/variantValue.js';
import * as logger from '../logger.js';
import type { DerivedProperties } from './derived/derivedProperty.js';
import type { SceneTreeNode } from './sceneRuntime.js';
import { WriteStore, type SceneWrites } from './sceneWrites.js';
import { sceneValueOf, valueOfSceneValue, type SceneValue } from './variant.js';

/** The class table and the defaults: hundreds of kB, so they load on the first `get` or `set`. */
export type PropertyAccess = typeof import('./propertyAccess.js');

export function loadPropertyAccess(): Promise<PropertyAccess> {
  return import('./propertyAccess.js');
}

/** The id prefix of a file `scene.load` gave, which no Godot-written id starts with. */
const LOADED_ID_PREFIX = 'textscene_load_';

/** The separator of a sub-resource's path, `res://main.tscn::Material_1`. */
const SUB_RESOURCE_SEPARATOR = '::';

/** The host's reads and writes of the properties of the scene's nodes, by live path. */
export class SceneProperties {
  private readonly store = new WriteStore();
  /** Written only by `derivedAt`. Cleared with the writes, since a new text frees each node. */
  private readonly derived = new Map<string, DerivedProperties | null>();
  /** Written only by `unknownProperty`: each name warned of, once for the scene's life. */
  private readonly warned = new Set<string>();
  /** Written only by `resourceText`: the files a write names, by path. */
  private readonly loaded = new Map<string, TscnExternalResource>();
  /** Written only by `resourceText` and `clear`: `loaded` as the written graph adds it. */
  private loadedList: readonly TscnExternalResource[] = [];

  constructor(
    private readonly rootScenePath: string,
    private readonly rootScene: () => ParsedScene | undefined
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

  get(access: PropertyAccess, livePath: string, node: SceneTreeNode, property: string): SceneValue | null {
    const derived = this.derivedAt(access, livePath, node);
    const outcome = access.resolveGet(node, property, derived, this.stored(access, livePath, node));
    if (outcome.kind === 'unknown') return this.unknownProperty(node, property, null);
    if (outcome.kind === 'unported') throw unportedProperty(property, outcome.declaredBy);
    return sceneValueOf(outcome.value);
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
    const outcome = access.resolveSet(node, property, variant, derived, this.stored(access, livePath, node));
    if (outcome.kind === 'unknown') return this.unknownProperty(node, property, false);
    if (outcome.kind === 'unported') throw unportedProperty(property, outcome.declaredBy);
    if (outcome.kind === 'dropped') return false;
    for (const [stored, written] of outcome.writes) {
      this.store.write('host', livePath, stored, this.textOf(written));
      // A derived setter keeps its own cache: only a write of the stored property itself resets it.
      if (stored === property) derived?.storedWritten(stored);
    }
    return outcome.isValid;
  }

  private derivedAt(access: PropertyAccess, livePath: string, node: SceneTreeNode): DerivedProperties | null {
    if (!this.derived.has(livePath)) this.derived.set(livePath, access.derivedPropertiesOf(node.type));
    return this.derived.get(livePath)!;
  }

  private stored(access: PropertyAccess, livePath: string, node: SceneTreeNode) {
    const classExists = access.classExists;
    return access.storedValueOf({
      node,
      written: this.writes().get(livePath) ?? {},
      nodeReading: { classExists, resourceOf: (kind, id) => node.resourceOf(kind, id) },
      writtenReading: { classExists, resourceOf: (kind, id) => this.rootResourceOf(kind, id) },
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

  /** The resource an id of the host's writes names: a file `scene.load` gave, else one of the root scene. */
  private rootResourceOf(kind: 'ExtResource' | 'SubResource', id: string): ResourceReference | null {
    if (kind === 'SubResource') return { path: `${this.rootScenePath}${SUB_RESOURCE_SEPARATOR}${id}` };
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
    const [file, subId] = path.split(SUB_RESOURCE_SEPARATOR);
    if (subId !== undefined) {
      if (file === this.rootScenePath) return `SubResource("${subId}")`;
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
    `expected a ported property, got "${property}" of ${declaredBy}: this release has no port of its setter and getter`
  );
}
