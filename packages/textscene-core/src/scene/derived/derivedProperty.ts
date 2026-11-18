import type { VariantValue } from '../../godot/variant/variantValue.js';

/** The stored values of one node as its setters read them: the laid text, else the class default. */
export type StoredValue = (property: string) => VariantValue;

/** A stored property a derived setter writes, with the value it takes. */
export type StoredWrite = readonly [property: string, value: VariantValue];

/** Another node's properties as `get` answers them, for a setter that reads up the tree. */
export interface NodeReader {
  /** The Godot class. */
  readonly type: string;
  /** Undefined where this release has no port of the property's getter. */
  get(property: string): VariantValue | undefined;
  /** Null above the scene's root node. */
  parent(): NodeReader | null;
}

/** What a setter or a getter of one node reads: its stored values and the node above it. */
export interface NodeReads {
  readonly stored: StoredValue;
  parent(): NodeReader | null;
}

/** A class family's unstored properties. A node keeps one while its text lives, as Godot keeps the cache. */
export interface DerivedProperties {
  /** Undefined for a name this family does not port. */
  get(property: string, reads: NodeReads): VariantValue | undefined;
  /** The stored writes `set` makes, or undefined for a name this family does not port. */
  set(property: string, value: VariantValue, reads: NodeReads): readonly StoredWrite[] | undefined;
  /** Tells the cache that `property` was written as it is stored. */
  storedWritten?(property: string): void;
}
