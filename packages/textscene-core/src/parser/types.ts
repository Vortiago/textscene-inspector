/**
 * Type definitions for TSCN data structures
 */

import type { Node3DProperties } from '../nodes/base/node3d/types';
import type { ResourceLoader } from '../resources/ResourceLoader';

/**
 * Represents a complete TSCN scene
 */
export interface TscnScene {
  /** Root nodes in the scene tree */
  nodes: TscnNode[];
  /** External resource references */
  externalResources: TscnExternalResource[];
  /** Internal resource definitions */
  internalResources: TscnInternalResource[];
  /** Event-based resource loader (used by SceneGraph helpers). */
  resourceLoader?: ResourceLoader;
}

/**
 * Represents a node in the TSCN scene tree
 */
export interface TscnNode {
  /** Node name */
  name: string;
  /** Node type (e.g., "Node3D", "MeshInstance3D") */
  type: string;
  /** Parent node path ("." for root, "NodeName" for named parent) */
  parent?: string;
  /** Child nodes */
  children: TscnNode[];
  /** Type-specific properties (e.g., Node3DProperties for Node3D nodes) */
  properties: Node3DProperties | Record<string, unknown>;
  /** Raw body properties as strings, retained so a type-less instance node's overrides can be re-parsed against the instanced root's type. */
  rawProperties?: Record<string, string>;
  /**
   * Whether `rawProperties`' key insertion order reflects a SINGLE file's
   * real property order (`Object.keys` order = scan order, ADR-0035) rather
   * than a synthesized bag. `core/NodeRegistry.ts`'s `parseNodeWithRegistry`
   * sets this `true` for every node it builds — one `TscnParserCore` scan.
   * `resources/mergeInstanceRoot.ts`'s raw merge
   * (`{ ...root.rawProperties, ...instanceNode.rawProperties }`) produces
   * neither file's order (a shared key keeps ROOT's position but the
   * INSTANCE's value), so it sets this `false` on the node it returns. A
   * file-order-sensitive resolver (`r3f/controls/controlAnchors.ts`'s
   * `resolveControlLayout`, `nodes/2d/ui/shared/range.ts`'s
   * `resolveRangeValue`) must fall back to Godot's editor-save-order
   * assumption unless this is `true`.
   */
  rawPropertiesOrderReliable?: boolean;
  /**
   * Set when this node's authored `parent` path descends INTO instanced content
   * — a `.tscn` PackedScene or a `.glb` — whose interior this file does not
   * declare. The node is attached in the tree to the nearest enclosing INSTANCE
   * node, and this holds the remainder of the path BELOW that instance
   * (`"Skeleton/Skeleton3D"`, `"ColorRect/CenterContainer/VBoxContainer"`).
   * Never the empty string.
   *
   * `parent` keeps the authored path verbatim, so this is purely additive: the
   * linter and `mergeInstanceRoot`'s re-parse both still read what the file said.
   */
  instanceSubPath?: string;
  /**
   * True when the `[node]` heading declared neither `type=` nor `instance=` —
   * Godot's marker for "override properties on the node already at this path"
   * rather than "add a new node here". See `isPropertyOverrideHeading`.
   */
  overridesExistingNode?: boolean;
  /**
   * The resource scope this node's subtree must resolve against, set when the
   * node has been grafted into content loaded from ANOTHER scene. It was
   * authored in the outer scene, so its `ExtResource("3")` and its
   * `SubResource("1")` alike mean whatever the OUTER tables say — under the
   * sub-scene's tables the same id is a different resource, or absent entirely.
   */
  authoredScope?: SceneScope;
  /** External scene instance reference (e.g., ExtResource("1_abc")) */
  instance?: string;
}

/**
 * Represents an external resource reference
 */
export interface TscnExternalResource {
  id: string;
  path: string;
  type: string;
}

/**
 * The resource scope a subtree resolves its ids against — BOTH pools, always
 * together.
 *
 * They travel as one value rather than two parameters because a `.tscn`'s ids
 * are per-file and per-KIND: a node can name `ExtResource("2")` and
 * `SubResource("1")` in the same property block, and both mean "in the scene I
 * was authored in". Splitting them lets a caller pass one and forget the other,
 * which resolves half the ids against the right scene and half against nothing
 * — a StyleBox that silently comes back `undefined` while the textures beside
 * it load fine. That is not hypothetical: while these were separate parameters
 * (one required, one optional), BOTH consumers that needed the SubResource pool
 * shipped call sites that compiled, ran, and passed their full suites with it
 * omitted. One type makes the omission unrepresentable instead of untested.
 */
export interface SceneScope {
  readonly externalResources: readonly TscnExternalResource[];
  readonly internalResources: readonly TscnInternalResource[];
}


/**
 * Represents an internal resource
 */
export interface TscnInternalResource {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/** Alias used by the immutable SceneGraph and dependency-tracking helpers. */
export type ExtResource = TscnExternalResource;
/** Alias used by the immutable SceneGraph and dependency-tracking helpers. */
export type SubResource = TscnInternalResource;

/**
 * Represents a missing external resource that failed to load
 */
export interface MissingResource {
  /** Godot resource path (e.g., res://scenes/Door.tscn) */
  path: string;
  /** Resource type (e.g., PackedScene, Texture2D, StandardMaterial3D) */
  type: string;
  /** Node path that references this resource */
  referencedBy: string;
  /** Error message from failed load attempt */
  error?: string;
}

/**
 * Callback invoked when renderer needs a resource that isn't available.
 * Return the resource content if available, or null if unavailable.
 *
 * @param resource - Details about the missing resource
 * @returns Resource content (string for text, ArrayBuffer for binary), or null if unavailable
 */
export type ResourceNeededCallback = (resource: MissingResource) => Promise<string | ArrayBuffer | null>;
