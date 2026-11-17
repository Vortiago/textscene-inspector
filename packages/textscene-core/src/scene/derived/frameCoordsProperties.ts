import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';
import { intValue, numberOf, pairOf } from './valueOf.js';

/** The `frame_coords` of a Sprite2D and a Sprite3D, over the stored `frame` (`sprite_2d.cpp:311-320`). */
export class FrameCoordsProperties implements DerivedProperties {
  storedWritten(): void {}

  get(property: string, { stored }: NodeReads): VariantValue | undefined {
    if (property !== 'frame_coords') return undefined;
    const frame = numberOf(stored('frame'));
    const hframes = numberOf(stored('hframes'));
    return { type: T.VECTOR2I, value: [frame % hframes, Math.trunc(frame / hframes)] };
  }

  /** A coordinate outside the sheet fails `ERR_FAIL_INDEX` and leaves the frame as it was. */
  set(property: string, value: VariantValue, { stored }: NodeReads): readonly StoredWrite[] | undefined {
    if (property !== 'frame_coords') return undefined;
    const { x, y } = pairOf(value);
    const hframes = numberOf(stored('hframes'));
    const isInSheet = x >= 0 && x < hframes && y >= 0 && y < numberOf(stored('vframes'));
    return isInSheet ? [['frame', intValue(y * hframes + x)]] : [];
  }
}
