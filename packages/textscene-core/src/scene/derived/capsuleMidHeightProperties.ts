import type { VariantValue } from '../../godot/variant/variantValue.js';
import { storedReal as f } from '../../godot/math/real.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';
import { numberOf, realValue } from './valueOf.js';

/** The capsule's `mid_height` over `height` and `radius` (`spring_bone_collision_capsule_3d.cpp:63-73`). */
export class CapsuleMidHeightProperties implements DerivedProperties {
  get(property: string, { stored }: NodeReads): VariantValue | undefined {
    if (property !== 'mid_height') return undefined;
    return realValue(numberOf(stored('height')) - f(numberOf(stored('radius')) * 2));
  }

  /** A negative mid-height fails `ERR_FAIL_COND_MSG` and leaves the height as it was. */
  set(property: string, value: VariantValue, { stored }: NodeReads): readonly StoredWrite[] | undefined {
    if (property !== 'mid_height') return undefined;
    const midHeight = f(numberOf(value));
    if (midHeight < 0) return [];
    return [['height', realValue(midHeight + f(numberOf(stored('radius')) * 2))]];
  }
}
