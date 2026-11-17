import type { VariantValue } from '../../godot/variant/variantValue.js';

/** The stored values of one node as its setters read them: the laid text, else the class default. */
export type StoredValue = (property: string) => VariantValue;

/** A stored property a derived setter writes, with the value it takes. */
export type StoredWrite = readonly [property: string, value: VariantValue];

/**
 * The setters and getters of the properties a class reaches that no file stores, ported for one
 * class family. A node of it keeps one instance for the life of its text, as Godot keeps the cache.
 */
export interface DerivedProperties {
  /** Undefined for a name this family does not port. */
  get(property: string, stored: StoredValue): VariantValue | undefined;
  /** The stored writes `set` makes, or undefined for a name this family does not port. */
  set(property: string, value: VariantValue, stored: StoredValue): readonly StoredWrite[] | undefined;
  /** Tells the cache that `property` was written as it is stored. */
  storedWritten(property: string): void;
}
