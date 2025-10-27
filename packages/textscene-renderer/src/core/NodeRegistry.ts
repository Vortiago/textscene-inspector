/**
 * Central registry for TSCN node types - enables self-registration of node parsers and renderers.
 */

import * as THREE from 'three';
import type { ParsedHeading } from '../parser/utils';
import type { TscnNode, TscnScene } from '../parser/types';
import { warn } from '../logger';

export interface NodeTypeRegistration {
  /** Node type name (e.g., 'MeshInstance3D', 'Node3D') */
  typeName: string;

  /** Type guard to check if a heading matches this node type */
  typeGuard: (heading: ParsedHeading) => boolean;

  /** Parse heading and properties into node properties object */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic registry supports any node property type
  parser: (heading: ParsedHeading, properties: Record<string, string>) => any;

  /** Create THREE.js object from parsed properties */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic registry accepts any parsed properties
  renderer: (name: string, properties: any, scene?: TscnScene) => THREE.Object3D;
}

class NodeRegistry {
  private registrations = new Map<string, NodeTypeRegistration>();

  register(registration: NodeTypeRegistration): void {
    if (this.registrations.has(registration.typeName)) {
      warn(`Node type "${registration.typeName}" is already registered. Overwriting.`);
    }
    this.registrations.set(registration.typeName, registration);
  }

  findRegistration(heading: ParsedHeading): NodeTypeRegistration | null {
    for (const registration of this.registrations.values()) {
      if (registration.typeGuard(heading)) {
        return registration;
      }
    }
    return null;
  }

  getRegistration(typeName: string): NodeTypeRegistration | null {
    return this.registrations.get(typeName) || null;
  }

  getAllTypeNames(): string[] {
    return Array.from(this.registrations.keys());
  }

  clear(): void {
    this.registrations.clear();
  }
}

export const nodeRegistry = new NodeRegistry();

export function parseNodeWithRegistry(
  heading: ParsedHeading,
  properties: Record<string, string>
): TscnNode | null {
  const registration = nodeRegistry.findRegistration(heading);

  if (!registration) {
    const nodeType = heading.attributes.type || 'unknown';
    warn(`Unsupported node type: ${nodeType}`);
    return null;
  }

  const parsedProps = registration.parser(heading, properties);

  return {
    name: parsedProps.name,
    type: registration.typeName,
    parent: parsedProps.parent,
    children: [],
    properties: parsedProps,
  };
}

export function renderNodeWithRegistry(
  node: TscnNode,
  scene?: TscnScene
): THREE.Object3D | null {
  const registration = nodeRegistry.getRegistration(node.type);

  if (!registration) {
    warn(`Unsupported node type for rendering: ${node.type}`);
    return null;
  }

  return registration.renderer(node.name, node.properties, scene);
}
