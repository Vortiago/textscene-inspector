/**
 * Type definitions for TSCN data structures
 */

import type { Node3DProperties } from '../nodes/node3d/types';

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
}

/**
 * Represents an external resource reference
 */
export interface TscnExternalResource {
  id: number;
  path: string;
  type: string;
}

/**
 * Represents an internal resource
 */
export interface TscnInternalResource {
  id: number;
  type: string;
  data: Record<string, unknown>;
}
