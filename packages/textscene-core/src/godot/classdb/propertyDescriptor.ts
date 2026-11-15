/**
 * The **property descriptor**: what this repository knows about one Godot property. It is the
 * ClassDB capture row (name, Variant type, hint, hint string) plus an optional hand row, which
 * states only what ClassDB cannot report. Any catalogued class answers, so a class needs no hand
 * table for a reader to know its properties. THREE-free and React-free, so the linter reads it.
 */

import type { IntWidth } from '../variant/intWidth.js';
import { findInClassChain } from './classBaseTypes.js';
import { findClassProperty, isUncatalogued, type ClassProperty } from './classProperty.js';
import { CLASSDB_CAPTURE_VERSION } from './classProperties.generated.js';

/** One end of a setter's own limit, where it sits apart from the hint's end. */
export interface SetterEnd {
  readonly at: number;
  /** `ERR_FAIL_COND(x <= at)` rather than `< at`: the endpoint is refused too. */
  readonly exclusive?: boolean;
}

/**
 * The setter's refusal or clamp (ADR-0032, the error tier). With no end, the setter refuses what
 * the hint excludes, at the hint's own ends. An end given here is the setter's own limit, and the
 * hint's end beside it keeps warning.
 */
export interface SetterFact {
  /** `file:line` of the `ERR_FAIL*`, the clamp or the dropped write. */
  readonly cite: string;
  readonly min?: SetterEnd;
  readonly max?: SetterEnd;
}

/** The hand row: only what the engine source says and ClassDB does not report. */
export interface PropertyFacts {
  readonly setter?: SetterFact;
  /** The C++ integer type of the slot, where the bounds do not imply it. */
  readonly width?: IntWidth;
  /** A message that replaces the derived range wording. */
  readonly message?: string;
  /**
   * The enum's constant names by value, for a message that prints `KEEP_WIDTH`: the capture
   * holds only the hint labels (`Keep Width`).
   */
  readonly labels?: Readonly<Record<number, string>>;
}

export interface PropertyDescriptor {
  readonly property: ClassProperty;
  readonly facts: PropertyFacts | undefined;
  /** What a bound read from the capture row cites, in place of a `file:line` (ADR-0032). */
  readonly cite: string;
}

/**
 * Hand rows by class, then key. Written only by {@link registerPropertyFacts}, which a slice calls
 * on import, and never cleared.
 */
const handRows = new Map<string, Record<string, PropertyFacts>>();

/**
 * Register the hand rows of `className`. A key the capture does not hold for the class throws, as
 * does a key the class already has a row for, since a merge would drop one in silence.
 */
export function registerPropertyFacts(
  className: string,
  rows: Readonly<Record<string, PropertyFacts>>
): void {
  const own = handRows.get(className) ?? {};
  for (const key of Object.keys(rows)) {
    if (!findClassProperty(className, key)) {
      throw new Error(`${className} has no captured property '${key}'; a hand row states facts about one`);
    }
    if (Object.hasOwn(own, key)) throw new Error(`${className} already has a hand row for '${key}'`);
  }
  handRows.set(className, Object.assign(own, rows));
}

/** The hand row nearest `className` for `key`, or undefined. */
function factsFor(className: string, key: string): PropertyFacts | undefined {
  return findInClassChain(className, (type) => {
    const rows = handRows.get(type);
    return rows && Object.hasOwn(rows, key) ? rows[key] : undefined;
  });
}

/** `ClassDB 4.6.3: Camera3D.near`: the capture, the class that declares the row and the key. */
function captureCite(property: ClassProperty): string {
  return `ClassDB ${CLASSDB_CAPTURE_VERSION}: ${property.declaredBy}.${property.name}`;
}

/**
 * The descriptor of `className`'s property `key`, or undefined where the capture holds no row
 * for it. A class whose rows come from a later release's source has none either: those rows cannot
 * cite the capture.
 */
export function propertyDescriptor(className: string, key: string): PropertyDescriptor | undefined {
  const property = findClassProperty(className, key);
  if (!property || isUncatalogued(property.declaredBy)) return undefined;
  return { property, facts: factsFor(className, key), cite: captureCite(property) };
}
