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
  /** Event-based resource loader (WI-79 salvage, used by SceneGraph helpers). */
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
