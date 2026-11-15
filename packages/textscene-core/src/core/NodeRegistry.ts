/**
 * The override a merged property map holds. Godot runs the base's setters, then the override's in
 * its own file order (`packed_scene.cpp:264`, `:369-492`), so a setter that reads another property needs
 * what the base left and which keys the override writes.
 */
export interface OverrideLayer<Properties> {
  /** The properties the node held before the override. */
  held: Properties;
  /** The keys the override writes, in its file's order. */
  written: Record<string, string>;
}

/**
 * The registry of TSCN node types. Each type self-registers a parser, which turns snake_case
 * body properties into its typed shape (`material_override` → `materialOverride`), and an
 * optional formatter for `<NodeDetailsPanel>`. Rendering lives in `r3f/NodeComponentRegistry.ts`.
 */

import type { ChildVisibilityFn } from './childVisibility';
import { isPropertyOverrideHeading, type ParsedHeading } from '../parser/utils';
import { headingIndexField } from '../parser/rawNode';
import { INSTANCE_PLACEHOLDER_TYPE } from '../godot/scene/packedScene';
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
type PropertyFormatter = (properties: any) => PropertySection[];

export interface NodeTypeRegistration {
  /** Node type name, such as 'MeshInstance3D' or 'Node3D'. */
  typeName: string;

  /**
   * Parse heading and properties into node properties object. `override` is present where
   * `properties` is a base's map with an override's keys layered on.
   */
  parser: (
    heading: ParsedHeading,
    properties: Record<string, string>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic registry supports any node property type
    override?: OverrideLayer<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic registry supports any node property type
  ) => any;

  /** Optional property formatter for custom details panel display */
  propertyFormatter?: PropertyFormatter;

  /** The `visible` the node writes onto its children, for a container that writes one. */
  writesChildVisibility?: ChildVisibilityFn;
}

class NodeRegistry {
  // The shared ADR-0002 registry, so the parser, 3D-render and 2D-render domains share one
  // overwrite-with-a-warn contract.
  private registrations = createTypeRegistry<NodeTypeRegistration>('NodeRegistry');

  register(registration: NodeTypeRegistration): void {
    this.registrations.register(registration.typeName, registration);
  }

  /** Remove one registration (test teardown for probe types); true if it existed. */
  unregister(typeName: string): boolean {
    return this.registrations.unregister(typeName);
  }

  findRegistration(heading: ParsedHeading): NodeTypeRegistration | null {
    // Only a `[node]` heading resolves: a `[sub_resource type="BoxMesh"]` must never match a
    // node typeName.
    if (heading.type !== 'node') return null;
    const type = heading.attributes.type;
    if (!type) return null;
    return this.registrations.get(type) ?? null;
  }

  getRegistration(typeName: string): NodeTypeRegistration | null {
    return this.registrations.get(typeName) ?? null;
  }

  /** The `visible` a node of `typeName` writes onto its children, or undefined for one that writes none. */
  childVisibility(typeName: string): ChildVisibilityFn | undefined {
    return this.registrations.get(typeName)?.writesChildVisibility;
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
  const instanceRef = heading.attributes.instance || properties.instance;
  // An `instance_placeholder=` heading is an InstancePlaceholder node
  // (packed_scene.cpp:255): a node of its own, not an override.
  const placeholderPath = heading.attributes.instance_placeholder;
  const hasInstanceAttribute = !!instanceRef || !!placeholderPath;

  const registration = nodeRegistry.findRegistration(heading);

  // The base Node fallback keeps unsupported types and instance nodes in the tree.
  if (!registration) {
    const originalType = heading.attributes.type || (placeholderPath ? INSTANCE_PLACEHOLDER_TYPE : 'Node');

    // An instance node has no type until loaded, so only an unsupported type warns.
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
      // One TscnParserCore scan built `properties`, so its key order is the node's file
      // order (ADR-0035).
      rawPropertiesOrderReliable: true,
    };

    if (isPropertyOverrideHeading(heading)) node.overridesExistingNode = true;
    if (heading.attributes.owner) node.owner = heading.attributes.owner;
    Object.assign(node, headingIndexField(heading));

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
    // One TscnParserCore scan built `properties`, so its key order is the node's file
    // order (ADR-0035).
    rawPropertiesOrderReliable: true,
  };

  if (heading.attributes.owner) node.owner = heading.attributes.owner;
  Object.assign(node, headingIndexField(heading));

  // `instance` can be a heading attribute or a body property.
  if (heading.attributes.instance) {
    node.instance = heading.attributes.instance;
  } else if (properties.instance) {
    node.instance = properties.instance;
  }

  return node;
}
