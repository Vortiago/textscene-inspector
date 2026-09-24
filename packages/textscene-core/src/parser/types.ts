/**
 * The data structures a TSCN parse produces: scene, node, resources and scope.
 */

import type { Node3DProperties } from '../nodes/base/node3d/types';
import type { ResourceLoader } from '../resources/ResourceLoader';

/**
 * One `[node]` heading as the scan saw it, before `buildSceneTree` placed it. Kept off
 * `TscnNode` because only `strandedNodes` and `rootDeclaringParent` read it, both
 * against the returned tree.
 */
export interface NodeOrigin {
  readonly node: TscnNode;
  /** 1-based line of the node's own heading. */
  readonly line: number;
  /**
   * The heading's `parent=` as written, or undefined where it declares none. Not
   * `node.parent`, which both parsers leave unset for an empty one: `add_node_path`
   * never returns `-1` (`packed_scene.cpp:2307-2311`), so `parent=""` cannot reach the
   * `n.parent == -1` refusal.
   */
  readonly declaredParent: string | undefined;
  /**
   * Whether the heading carries `parent_id_path=`, the id trail Godot falls back to
   * when the `parent=` path does not walk (`packed_scene.cpp:161-163`, `:1947`). The
   * ids name nodes inside base scenes this file cannot resolve, so a vanished path
   * here does not settle where the node lands.
   */
  readonly recoverableById?: boolean;
}

export interface TscnScene {
  /** Root nodes in the scene tree. */
  nodes: TscnNode[];
  externalResources: TscnExternalResource[];
  internalResources: TscnInternalResource[];
  /**
   * Headings whose `parent=` path resolved against nothing, so they are not in
   * `nodes`. Absent rather than empty when nothing was stranded.
   */
  orphanedNodes?: readonly NodeOrigin[];
  /**
   * The root heading, when it declares a `parent=`, which Godot refuses
   * (`packed_scene.cpp:218-219`). Absent otherwise, since a present-but-empty key
   * would change the object shape the render path sees for every well-formed scene.
   */
  rootWithParent?: NodeOrigin;
  /**
   * Headings spelling `parent=""`, which faults the text loader
   * (`resource_format_text.cpp:206-207`). Absent rather than empty. Not a subset of the
   * fields above: such a heading has no `node.parent`, so it is seated, not stranded.
   */
  emptyParentHeadings?: readonly NodeOrigin[];
  /** Event-based resource loader, used by SceneGraph helpers. */
  resourceLoader?: ResourceLoader;
}

export interface TscnNode {
  name: string;
  /** Godot class name, for example "Node3D". */
  type: string;
  /** Parent node path: "." for the root's children, "NodeName" for a named parent. */
  parent?: string;
  children: TscnNode[];
  /** Type-specific properties, for example Node3DProperties for a Node3D. */
  properties: Node3DProperties | Record<string, unknown>;
  /**
   * Raw body properties as written, published by both parsers
   * (`parser/rawPropertyParity.test.ts`), so read this from code the linter and the
   * render path share. `properties` differs by parser. It also lets a type-less
   * instance node's overrides be re-parsed against the instanced root's type.
   */
  rawProperties?: Record<string, string>;
  /**
   * Whether `rawProperties`' key order is one file's scan order (ADR-0035).
   * `core/NodeRegistry.ts`'s `parseNodeWithRegistry` sets `true`. The raw merge in
   * `resources/mergeInstanceRoot.ts` sets `false`: a shared key keeps the root's
   * position but the instance's value.
   */
  // A file-order-sensitive resolver (`r3f/controls/controlAnchors.ts`'s
  // `resolveControlLayout`, `nodes/2d/ui/shared/range.ts`'s `resolveRangeValue`)
  // assumes Godot's editor save order unless this is `true`.
  rawPropertiesOrderReliable?: boolean;
  /**
   * Set when the authored `parent` path descends into instanced content (a `.tscn` or
   * `.glb`) this file does not declare: the path below the nearest enclosing instance,
   * which holds the node in the tree. Never the empty string. `parent` keeps the
   * authored path, so the linter and `mergeInstanceRoot` still read what the file said.
   */
  instanceSubPath?: string;
  /**
   * True when the heading declared none of `type=`, `instance=` and
   * `instance_placeholder=`: Godot's marker for overriding the node already at this
   * path. See `isPropertyOverrideHeading`.
   */
  overridesExistingNode?: boolean;
  /**
   * The resource scope this subtree resolves against, set when the node is grafted
   * into content loaded from another scene. It was authored in the outer scene, so its
   * `ExtResource` and `SubResource` ids mean what the outer tables say.
   */
  authoredScope?: SceneScope;
  /**
   * The heading's `owner=` NodePath as written, root-relative. The loader sets the owner
   * from it (resource_format_text.cpp:257-262), which decides the table a `%Name`
   * registers on. Godot's own writer never emits it (packed_scene.cpp:1036-1044).
   */
  owner?: string;
  /** External scene instance reference, for example ExtResource("1_abc"). */
  instance?: string;
}

export interface TscnExternalResource {
  id: string;
  path: string;
  type: string;
}

/**
 * The resource scope a subtree resolves its ids against: both pools, always together.
 * Ids are per file and per kind, and one property block can name `ExtResource("2")` and
 * `SubResource("1")`. One type makes it impossible to pass one pool and forget the
 * other, which resolves half the ids against nothing.
 */
export interface SceneScope {
  readonly externalResources: readonly TscnExternalResource[];
  readonly internalResources: readonly TscnInternalResource[];
}

export interface TscnInternalResource {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/** Alias used by the immutable SceneGraph and dependency-tracking helpers. */
export type ExtResource = TscnExternalResource;
/** Alias used by the immutable SceneGraph and dependency-tracking helpers. */
export type SubResource = TscnInternalResource;

/** An external resource that failed to load. */
export interface MissingResource {
  /** Godot resource path, for example res://scenes/Door.tscn. */
  path: string;
  /** Resource type, for example PackedScene or Texture2D. */
  type: string;
  /** Node path that references this resource. */
  referencedBy: string;
  /** Error message from the failed load. */
  error?: string;
}

/**
 * Called when the renderer needs a resource that is not available.
 *
 * @param resource - Details about the missing resource
 * @returns Resource content (string for text, ArrayBuffer for binary), or null if unavailable
 */
export type ResourceNeededCallback = (resource: MissingResource) => Promise<string | ArrayBuffer | null>;
