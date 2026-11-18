import { findInClassChain } from './classBaseTypes.js';
import {
  DERIVED_NODE_PROPERTIES,
  NODE_DEFAULT_OVERRIDES,
  NODE_DEFAULTS,
  type DerivedPropertyRow,
} from './nodeDefaults.generated.js';

/** `ClassDB::class_get_property_default_value` of a stored property, as `var_to_str` writes it. */
export function nodeDefaultText(className: string, property: string): string | undefined {
  const own = NODE_DEFAULT_OVERRIDES[className];
  if (own && Object.hasOwn(own, property)) return own[property];
  return findInClassChain(className, (type) => {
    const declared = NODE_DEFAULTS[type];
    return declared && Object.hasOwn(declared, property) ? declared[property] : undefined;
  });
}

/** A property a script reaches that no file stores, such as Node3D's `position`. */
export interface DerivedProperty {
  readonly name: string;
  /** variant.h:96-145 */
  readonly type: number;
  readonly hasSetter: boolean;
  readonly declaredBy: string;
}

export function findDerivedProperty(className: string, name: string): DerivedProperty | undefined {
  return findInClassChain(className, (type) => {
    const row = DERIVED_NODE_PROPERTIES[type]?.find(([rowName]) => rowName === name);
    return row && toDerivedProperty(row, type);
  });
}

function toDerivedProperty([name, type, hasSetter]: DerivedPropertyRow, declaredBy: string): DerivedProperty {
  return { name, type, hasSetter, declaredBy };
}
