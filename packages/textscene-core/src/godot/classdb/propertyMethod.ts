import { findInClassChain } from './classBaseTypes.js';
import { findClassProperty } from './classProperty.js';
import { findDerivedProperty } from './nodeDefault.js';
import { PROPERTY_METHODS, type PropertyMethodsRow } from './propertyMethods.generated.js';

/** The property a call of a setter or a getter reaches, by the index it passes where it passes one. */
export interface PropertyMethod {
  readonly role: 'setter' | 'getter';
  /** One property, or one for each index the method takes first. */
  readonly properties: ReadonlyMap<number | null, string>;
}

function declaredProperty(className: string, name: string): string | undefined {
  return (findClassProperty(className, name) ?? findDerivedProperty(className, name))?.declaredBy;
}

function rowOf(declaredBy: string, name: string): PropertyMethodsRow | undefined {
  return PROPERTY_METHODS[declaredBy]?.find(([rowName]) => rowName === name);
}

const PREFIX = { setter: 'set_', getter: 'get_' } as const;
const COLUMN = { setter: 1, getter: 2 } as const;

/** `ClassDB::get_property_setter` or `get_property_getter`: the empty name for a property with none. */
export function accessorOf(
  role: PropertyMethod['role'],
  className: string,
  property: string
): string | undefined {
  const declaredBy = declaredProperty(className, property);
  if (!declaredBy) return undefined;
  return rowOf(declaredBy, property)?.[COLUMN[role]] ?? `${PREFIX[role]}${property}`;
}

/** The rows of the nearest class that names `method` as a setter or a getter. */
function namedMethod(className: string, method: string): PropertyMethod | undefined {
  return findInClassChain(className, (type) => {
    const rows = (PROPERTY_METHODS[type] ?? []).filter(
      ([, setter, getter]) => setter === method || getter === method
    );
    const [first] = rows;
    if (!first) return undefined;
    const role = first[1] === method ? 'setter' : 'getter';
    return { role, properties: new Map(rows.map(([name, , , index]) => [index ?? null, name])) };
  });
}

/** `set_<name>` or `get_<name>` of a property whose methods carry those names. */
function prefixedMethod(className: string, method: string): PropertyMethod | undefined {
  const role = (['setter', 'getter'] as const).find((candidate) => method.startsWith(PREFIX[candidate]));
  if (!role) return undefined;
  const property = method.slice(PREFIX[role].length);
  return accessorOf(role, className, property) === method
    ? { role, properties: new Map([[null, property]]) }
    : undefined;
}

/** The property a call of `method` on a `className` node reaches, if `method` is a setter or a getter. */
export function findPropertyMethod(className: string, method: string): PropertyMethod | undefined {
  return namedMethod(className, method) ?? prefixedMethod(className, method);
}
