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
  /**
   * Raw body properties as strings, exactly as written. Published by BOTH parsers
   * (`parser/rawPropertyParity.test.ts`), so it is the one field whose meaning does
   * not depend on which produced the node — `properties` is the typed slice shape on
   * the lenient tree and this same bag on the strict one. Read this from anything the
   * linter and the render path share. Also what lets a type-less instance node's
   * overrides be re-parsed against the instanced root's type.
   */
  rawProperties?: Record<string, string>;
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
   * The ExtResource table this node's subtree must resolve against, set when the
   * node has been grafted into content loaded from ANOTHER scene. It was
   * authored in the outer scene, so its `ExtResource("3")` means whatever the
   * OUTER table says — under the sub-scene's table the same id is a different
   * resource, or absent entirely.
   */
  authoredResources?: readonly TscnExternalResource[];
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
