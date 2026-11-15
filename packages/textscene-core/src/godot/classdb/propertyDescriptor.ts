import type { IntWidth } from '../variant/intWidth.js';
import { findInClassChain } from './classBaseTypes.js';
import { findClassProperty, isUncatalogued, type ClassProperty } from './classProperty.js';
import { CLASSDB_CAPTURE_VERSION } from './classProperties.generated.js';

export interface SetterEnd {
  readonly at: number;
  /** `<=`, not `<`: the endpoint is refused too. */
  readonly exclusive?: boolean;
}

/** No end: the setter refuses at the hint's ends. An end: its own limit, and the hint keeps warning. */
export interface SetterFact {
  readonly cite: string;
  readonly min?: SetterEnd;
  readonly max?: SetterEnd;
}

/** Only what ClassDB cannot report. */
export interface PropertyFacts {
  readonly setter?: SetterFact;
  readonly width?: IntWidth;
  readonly message?: string;
  /** `KEEP_WIDTH`, where the capture holds only `Keep Width`. */
  readonly labels?: Readonly<Record<number, string>>;
}

export interface PropertyDescriptor {
  readonly property: ClassProperty;
  readonly facts: PropertyFacts | undefined;
  readonly cite: string;
}

/** Written only by {@link registerPropertyFacts} on slice import; never cleared. */
const handRows = new Map<string, Record<string, PropertyFacts>>();

/** Raised only by {@link registerPropertyFacts}, so a reader can drop a check built before a row. */
let handRowsRevision = 0;

export function handRowRevision(): number {
  return handRowsRevision;
}

/** @internal For the hand-row sweep in `linter/`. */
export function handRowKeys(): readonly { className: string; key: string }[] {
  return [...handRows].flatMap(([className, rows]) => Object.keys(rows).map((key) => ({ className, key })));
}

/** Throws on an uncaptured key or a second row for a key, rather than drop one in silence. */
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
  handRowsRevision++;
}

function factsFor(className: string, key: string): PropertyFacts | undefined {
  return findInClassChain(className, (type) => {
    const rows = handRows.get(type);
    return rows && Object.hasOwn(rows, key) ? rows[key] : undefined;
  });
}

/** `ClassDB 4.6.3: Camera3D.near` (ADR-0032). */
function captureCite(property: ClassProperty): string {
  return `ClassDB ${CLASSDB_CAPTURE_VERSION}: ${property.declaredBy}.${property.name}`;
}

/** Undefined for an uncatalogued class too: its rows cannot cite the capture. */
export function propertyDescriptor(className: string, key: string): PropertyDescriptor | undefined {
  const property = findClassProperty(className, key);
  if (!property || isUncatalogued(property.declaredBy)) return undefined;
  return { property, facts: factsFor(className, key), cite: captureCite(property) };
}
