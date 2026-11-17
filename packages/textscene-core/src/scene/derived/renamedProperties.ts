import type { VariantValue } from '../../godot/variant/variantValue.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';

/** A deprecated name over a stored one: `interpolation` over `influence` (`skeleton_ik_3d.cpp:418`). */
export class RenamedProperties implements DerivedProperties {
  constructor(private readonly renamed: ReadonlyMap<string, string>) {}

  get(property: string, { stored }: NodeReads): VariantValue | undefined {
    const target = this.renamed.get(property);
    return target === undefined ? undefined : stored(target);
  }

  set(property: string, value: VariantValue): readonly StoredWrite[] | undefined {
    const target = this.renamed.get(property);
    return target === undefined ? undefined : [[target, value]];
  }
}
