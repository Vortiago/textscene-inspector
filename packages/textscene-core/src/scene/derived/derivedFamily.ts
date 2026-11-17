import { descendsFromClass } from '../../godot/classdb/classBaseTypes.js';
import type { DerivedProperties } from './derivedProperty.js';
import { Node2DProperties } from './node2dProperties.js';
import { Node3DProperties } from './node3dProperties.js';

/** The ported family of a class, or null where none is ported yet. */
export function derivedPropertiesOf(className: string): DerivedProperties | null {
  if (descendsFromClass(className, 'Node3D')) return new Node3DProperties();
  if (descendsFromClass(className, 'Node2D')) return new Node2DProperties();
  return null;
}
