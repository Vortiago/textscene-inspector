/**
 * The data structures a TSCN parse produces: scene, node, resources and scope.
 */

import type { Node3DProperties } from '../nodes/base/node3d/types';
import type { InstanceNameSetting } from './nodeOwner';
import type { IdHeading } from '../godot/scene/packedScene.js';

/**
 * One `[node]` heading as the scan saw it, before `seatScene` placed it. Kept off
 * the node because only the `sceneTreeBuilder` checks read it, against the returned tree.
 */
export interface NodeOrigin<N extends RawNode> {
  readonly node: N;
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
   * The ids of the heading's `parent_id_path=`, the trail Godot falls back to when the
   * `parent=` path does not walk (`packed_scene.cpp:161-163`, `:1947`). Undefined where
   * the heading has none, or where the value is not a `PackedInt32Array`.
   */
  readonly idTrail?: readonly number[];
  /** The heading's `unique_id=`, or `0` where it has none (`UNIQUE_SCENE_ID_UNASSIGNED`). */
  readonly uniqueId: number;
}

/**
 * Where Godot seats an orphaned node through its `parent_id_path=`, in place of the re-root.
 * `lands` names the heading the node goes under. `inBase` names the instance heading whose
 * scene holds the rest of the trail, so this file cannot say where the node lands.
 */
export interface IdRecovery {
  readonly kind: 'lands' | 'inBase';
  readonly via: NodeOrigin<RawNode>;
  /** The root-relative path `via` is seated at, or undefined for a nameless heading, which claims none. */
  readonly viaPath: string | undefined;
}

/** A parsed scene. `N` is the node the parser built: a `TscnNode`, or the strict parser's `RawNode`. */
export interface TscnScene<N extends RawNode = TscnNode> {
  /** Root nodes in the scene tree. */
  nodes: N[];
  externalResources: TscnExternalResource[];
  internalResources: TscnInternalResource[];
  /**
   * A `.tres` file's `[gd_resource type=]`, the class the loader builds its `[resource]` body as
   * (`resource_format_text.cpp:1166`, `:741`). Absent in a `.tscn`, and where the header names no type.
   */
  resourceType?: string;
  /**
   * A `.tres` file's own `[resource]` body. Absent in a `.tscn`, where the loader refuses the tag
   * (`resource_format_text.cpp:723-728`).
   */
  mainResource?: TscnMainResource;
}

/**
 * The **Raw view** of a node: `rawProperties`, the literals both parsers publish, and no
 * typed `properties`. The strict parser builds this. A `TscnNode` is a `RawNode`, so a helper
 * typed on it takes either tree.
 */
export interface RawNode {
  name: string;
  /** Godot class name, for example "Node3D". */
  type: string;
  /** Parent node path: "." for the root's children, "NodeName" for a named parent. */
  parent?: string;
  children: RawNode[];
  /**
   * Raw body properties as written, published by both parsers
   * (`parser/rawPropertyParity.test.ts`), so read this from code the linter and the
   * render path share. It also lets a type-less instance node's overrides be re-parsed
   * against the instanced root's type.
   */
  rawProperties: Record<string, string>;
  /**
   * Whether `rawProperties`' key order is one file's scan order (ADR-0035).
   * `core/NodeRegistry.ts`'s `parseNodeWithRegistry` sets `true`.
   * `resources/layerRawOverride.ts` sets `false`: a shared key keeps the base's
   * position but the override's value.
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
   * The name the heading wrote, set only on a tree node the builder re-rooted: its `name`
   * is then Godot's rename for the vanished `parent` (`packed_scene.cpp:561-563`).
   */
  authoredName?: string;
  /**
   * True when the heading declared none of `type=`, `instance=` and
   * `instance_placeholder=`: Godot's marker for overriding the node already at this
   * path. See `isPropertyOverrideHeading`.
   */
  overridesExistingNode?: boolean;
  /**
   * The heading's `owner=` NodePath, root-relative. The loader sets the owner from it
   * (resource_format_text.cpp:257-262), which decides the table a `%Name` registers on. Godot's own
   * writer never emits it (packed_scene.cpp:1036-1044). A seated node holds it walked from the root
   * (`resolvedOwner`): `.` for the root, and each `%Name` the file answers replaced by its claimant.
   */
  owner?: string;
  /** External scene instance reference, for example ExtResource("1_abc"). */
  instance?: string;
  /**
   * Set by the seating on an instance node below the root, and on an inherited root: the
   * `unique_name_in_owner` settings this file writes inside its content, in file order. The graft
   * reads them, and a graft into an outer instance appends the ones it hands down.
   */
  instanceNameSettings?: readonly InstanceNameSetting[];
}

/**
 * What a node path names in the authored tree. `unknowable` is the only decline: Godot's walk is
 * deterministic, so there is no "ambiguous", and a rule that reports on a guess is worse than one
 * that stays quiet.
 */
export type NodePathResolution<N extends RawNode = RawNode> =
  | { readonly status: 'found'; readonly node: N }
  /** The walk ran off the authored tree exactly as the engine's would. */
  | { readonly status: 'missing' }
  /** The walk entered, started inside, or ended on content this file does not declare. */
  | { readonly status: 'unknowable' };

/** A node whose children are its own kind: the shape the tree builder seats a child into. */
export type SceneNode<N> = RawNode & { children: N[] };

/**
 * What one `[connection]` heading states. Each field is `undefined` when the heading omits it, which the text loader
 * refuses for the four it requires (`resource_format_text.cpp:311-333`).
 */
export interface ConnectionHeading {
  /** 1-based. */
  line: number;
  signal: string | undefined;
  from: string | undefined;
  to: string | undefined;
  method: string | undefined;
  /**
   * The `binds=` value as written. The loader parses a heading's fields with the resource parser a property value goes
   * through (`resource_format_text.cpp:286`, `:379`, `variant_parser.cpp:1862`), so an `ExtResource` in it is a use.
   */
  binds: string | undefined;
  /**
   * The ids of `from_uid_path=`, the trail Godot follows when `from` resolves nowhere (`packed_scene.cpp:162-163`).
   * Undefined where the heading has none, or where the value is not a `PackedInt32Array`.
   */
  fromIdTrail: readonly number[] | undefined;
  /** The ids of `to_uid_path=`, read as {@link ConnectionHeading.fromIdTrail} is. */
  toIdTrail: readonly number[] | undefined;
}

/** The **Heading facts**: what the `[node]` and `[connection]` headings state that the tree does not hold. */
export interface HeadingFacts {
  /**
   * Headings whose `parent=` names nothing: the nodes the builder re-rooted, which
   * `reRootedNames` holds, and those it left out of `nodes`, for a file or a trail Godot does not
   * re-root, or a later heading with no `parent=`.
   */
  orphanedNodes: readonly NodeOrigin<RawNode>[];
  /** The name the builder gave each re-rooted heading's node, which the heading's own node keeps unrenamed. */
  reRootedNames: ReadonlyMap<NodeOrigin<RawNode>, string>;
  /**
   * The root heading, when it declares a `parent=`, which Godot refuses
   * (`packed_scene.cpp:218-219`), or undefined.
   */
  rootWithParent: NodeOrigin<RawNode> | undefined;
  /**
   * Headings spelling `parent=""`, which faults the text loader
   * (`resource_format_text.cpp:206-207`). Not a subset of the fields above: such a heading has
   * no `node.parent`, so it is seated, not orphaned.
   */
  emptyParentHeadings: readonly NodeOrigin<RawNode>[];
  /**
   * Whether Godot gives up on the scene before it re-roots anything, so the builder re-roots no
   * orphan. True when `rootWithParent` is set, `emptyParentHeadings` is not empty, a later heading
   * has no `parent=`, or the root heading states no identifier.
   */
  refusesToInstantiate: boolean;
  /**
   * The orphans whose `parent_id_path=` Godot follows to a node, instead of re-rooting them.
   * An orphan absent here is re-rooted, or has no trail.
   */
  idRecoveries: ReadonlyMap<NodeOrigin<RawNode>, IdRecovery>;
  /** Every `[node]` heading in file order, as an id trail reads it (`packed_scene.cpp:1947-2005`). */
  idHeadings: readonly IdHeading[];
  /** Each `[connection]` heading, in file order. */
  connections: readonly ConnectionHeading[];
  /**
   * The `instance=` value of each `[node]` heading that follows no other `[node]`: the first, or one after a
   * `[connection]` or `[editable]`. Only a node body's read of the next heading skips a failed `ExtResource`
   * (`resource_format_text.cpp:288-289`). Every other read ends the load (`:533-536`, `:647-650`, `:381-384`,
   * `:404-407`).
   */
  instancesOutsideNodeBody: readonly string[];
}

/** The **Raw view** of a scene: the tree a **Lint rule** reads. */
export type RawScene = TscnScene<RawNode>;

/** What the strict parser returns: the **Raw view** and the heading facts. */
export interface StrictScene extends RawScene, HeadingFacts {}

/** A node from the lenient parser: the **Raw view** plus the typed values the renderer reads. */
export interface TscnNode extends RawNode {
  children: TscnNode[];
  /** Type-specific properties, for example Node3DProperties for a Node3D. */
  properties: Node3DProperties | Record<string, unknown>;
}

export interface TscnExternalResource {
  id: string;
  path: string;
  type: string;
  /** The id its own file wrote, on a copy that override re-homing made. The parser never sets it. */
  authoredId?: string;
}

/**
 * The resource scope a subtree resolves its ids against: both pools, always together,
 * and the instanced scenes that enclose it.
 * Ids are per file and per kind, and one property block can name `ExtResource("2")` and
 * `SubResource("1")`. One type makes it impossible to pass one pool and forget the
 * other, which resolves half the ids against nothing.
 */
export interface SceneScope {
  readonly externalResources: readonly TscnExternalResource[];
  readonly internalResources: readonly TscnInternalResource[];
  /**
   * The `res://` paths of the PackedScenes whose instances enclose this subtree,
   * outermost first. Absent means none. An instance of a path already here is cyclic
   * instancing: Godot's loader returns null for it (`resource_loader.cpp:838-845`).
   */
  readonly instancedScenePaths?: readonly string[];
}

export interface TscnInternalResource {
  id: string;
  type: string;
  data: Record<string, string>;
  /** The id its own file wrote, on a copy that override re-homing made. The parser never sets it. */
  authoredId?: string;
}

/**
 * A `.tres` file's `[resource]` body. It has no id and no `type=`: its class is the header's,
 * {@link TscnScene.resourceType}. `data` holds the raw values, keyed as the scan stores them.
 */
export interface TscnMainResource {
  data: Record<string, string>;
}

/** What the scan builds from one section: the object a strict consumer files the section's lines under. */
export type BuiltSection = RawNode | TscnInternalResource | TscnExternalResource | TscnMainResource;

/** Alias used by the immutable SceneGraph and dependency-tracking helpers. */
export type ExtResource = TscnExternalResource;
/** Alias used by the immutable SceneGraph and dependency-tracking helpers. */
export type SubResource = TscnInternalResource;
