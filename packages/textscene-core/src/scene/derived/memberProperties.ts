import type { VariantValue } from '../../godot/variant/variantValue.js';
import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';

/** A field no file stores, kept by its own name, as `sorting_offset` (`visual_instance_3d.cpp:150-166`). */
export class MemberProperties implements DerivedProperties {
  /** `defaults` holds each field's initial value, from the class header. */
  constructor(private readonly defaults: ReadonlyMap<string, VariantValue>) {}

  get(property: string, { stored }: NodeReads): VariantValue | undefined {
    const initial = this.defaults.get(property);
    if (initial === undefined) return undefined;
    const value = stored(property);
    return value.type === T.NIL ? initial : value;
  }

  set(property: string, value: VariantValue): readonly StoredWrite[] | undefined {
    return this.defaults.has(property) ? [[property, value]] : undefined;
  }
}
