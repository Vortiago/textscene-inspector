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

const SETTER_PREFIX = 'set_';
const GETTER_PREFIX = 'get_';

function declaredProperty(className: string, name: string): string | undefined {
  return (findClassProperty(className, name) ?? findDerivedProperty(className, name))?.declaredBy;
}

function rowOf(declaredBy: string, name: string): PropertyMethodsRow | undefined {
  return PROPERTY_METHODS[declaredBy]?.find(([rowName]) => rowName === name);
}

/** `ClassDB::get_property_setter`: the empty name for a property with none. */
export function setterOf(className: string, property: string): string | undefined {
  const declaredBy = declaredProperty(className, property);
  if (!declaredBy) return undefined;
  return rowOf(declaredBy, property)?.[1] ?? `${SETTER_PREFIX}${property}`;
}

/** `ClassDB::get_property_getter`: the empty name for a property with none. */
export function getterOf(className: string, property: string): string | undefined {
  const declaredBy = declaredProperty(className, property);
  if (!declaredBy) return undefined;
  return rowOf(declaredBy, property)?.[2] ?? `${GETTER_PREFIX}${property}`;
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
  const role = method.startsWith(SETTER_PREFIX)
    ? 'setter'
    : method.startsWith(GETTER_PREFIX)
      ? 'getter'
      : null;
  if (!role) return undefined;
  const property = method.slice((role === 'setter' ? SETTER_PREFIX : GETTER_PREFIX).length);
  const named = role === 'setter' ? setterOf(className, property) : getterOf(className, property);
  return named === method ? { role, properties: new Map([[null, property]]) } : undefined;
}

/** The property a call of `method` on a `className` node reaches, if `method` is a setter or a getter. */
export function findPropertyMethod(className: string, method: string): PropertyMethod | undefined {
  return namedMethod(className, method) ?? prefixedMethod(className, method);
}
