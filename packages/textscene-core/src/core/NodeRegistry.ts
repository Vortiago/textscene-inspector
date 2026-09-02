/**
 * Central registry for TSCN node types.
 *
 * Each node type self-registers its parser, type-guard, and optional
 * property formatter. The parser turns raw snake_case TSCN body
 * properties into the type's strongly-typed properties shape
 * (e.g. `material_override` → `materialOverride`). The formatter is
 * consumed by the R3F `<NodeDetailsPanel>` for the details view.
 *
 * Historical note: this used to also carry a `renderer` callback that
 * returned a `THREE.Object3D` for the imperative renderer pipeline.
 * The R3F migration removed the imperative path and the `renderer` field
 * with it; rendering now happens via the parallel `nodeComponentRegistry`
 * in `r3f/NodeComponentRegistry.ts`.
 */

import { isPropertyOverrideHeading, type ParsedHeading } from '../parser/utils';
import type { TscnNode } from '../parser/types';
import { warn } from '../logger';
import { createTypeRegistry } from './createTypeRegistry';

export interface PropertyItem {
  label: string;
  value: string;
}

export interface PropertySection {
  title: string;
  items: PropertyItem[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic formatter accepts any parsed properties
export type PropertyFormatter = (properties: any) => PropertySection[];

export interface NodeTypeRegistration {
  /** Node type name (e.g., 'MeshInstance3D', 'Node3D') */
  typeName: string;

  /**
   * Optional legacy type guard. The registry matches a heading by its
   * `type` attribute against `typeName` directly, so a guard is no longer
   * needed; the field is retained only for back-compat and is ignored by
   * `findRegistration`.
   */
  typeGuard?: (heading: ParsedHeading) => boolean;

  /** Parse heading and properties into node properties object */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic registry supports any node property type
  parser: (heading: ParsedHeading, properties: Record<string, string>) => any;

  /** Optional property formatter for custom details panel display */
  propertyFormatter?: PropertyFormatter;
}

class NodeRegistry {
  // Backed by the shared ADR-0002 registry so all three domains (parser,
  // 3D-render, 2D-render) share ONE tested overwrite-with-a-warn contract
  // instead of this class carrying its own bespoke Map.
  private registrations = createTypeRegistry<NodeTypeRegistration>('NodeRegistry');

  register(registration: NodeTypeRegistration): void {
    this.registrations.register(registration.typeName, registration);
  }

  /** Remove one registration (test teardown for probe types); true if it existed. */
  unregister(typeName: string): boolean {
    return this.registrations.unregister(typeName);
  }

  findRegistration(heading: ParsedHeading): NodeTypeRegistration | null {
    // Only `[node]` headings resolve to a node registration — a
    // `[sub_resource type="BoxMesh"]` must never match a node typeName.
    // The registry is keyed by typeName, so the lookup is O(1) and the match is
    // exactly what the old per-type guards computed (`attributes.type === typeName`).
    if (heading.type !== 'node') return null;
    const type = heading.attributes.type;
    if (!type) return null;
    return this.registrations.get(type) ?? null;
  }

  getRegistration(typeName: string): NodeTypeRegistration | null {
    return this.registrations.get(typeName) ?? null;
  }

  getAllTypeNames(): string[] {
    return this.registrations.getAllTypeNames();
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
  // Check if this is an instance node (has instance attribute but no type)
  const instanceRef = heading.attributes.instance || properties.instance;
  const hasInstanceAttribute = !!instanceRef;

  const registration = nodeRegistry.findRegistration(heading);

  // If no registration found, use base Node type as fallback
  // This keeps unsupported types and instance nodes in the tree hierarchy
  if (!registration) {
    const originalType = heading.attributes.type || 'Node';

    // Warn for truly unsupported types, but not for instance nodes (which have no type until loaded)
    if (!hasInstanceAttribute) {
      warn(`[NodeRegistry] Unsupported node type: ${originalType} - using Node fallback renderer`);
    }

    const nodeRegistration = nodeRegistry.getRegistration('Node');
    if (!nodeRegistration) {
      warn('[NodeRegistry] Node registration not found - cannot create fallback node');
      return null;
    }

    const parsedProps = nodeRegistration.parser(heading, properties);
    const node: TscnNode = {
      name: parsedProps.name,
      type: originalType,
      parent: parsedProps.parent,
      children: [],
      properties: parsedProps,
      rawProperties: properties,
    };

    if (isPropertyOverrideHeading(heading)) node.overridesExistingNode = true;
    if (heading.attributes.owner) node.owner = heading.attributes.owner;

    // Preserve instance attribute for external scene loading
    if (hasInstanceAttribute) {
      node.instance = instanceRef;
    }

    return node;
  }

  const parsedProps = registration.parser(heading, properties);

  const node: TscnNode = {
    name: parsedProps.name,
    type: registration.typeName,
    parent: parsedProps.parent,
    children: [],
    properties: parsedProps,
    rawProperties: properties,
  };

  if (heading.attributes.owner) node.owner = heading.attributes.owner;

  // Capture instance property for external scene references
  // instance can be in heading attributes OR body properties
  if (heading.attributes.instance) {
    node.instance = heading.attributes.instance;
  } else if (properties.instance) {
    node.instance = properties.instance;
  }

  return node;
}

