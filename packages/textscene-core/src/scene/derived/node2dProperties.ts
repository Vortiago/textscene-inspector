import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import { storedReal as f } from '../../godot/math/real.js';
import { transform2DDecompose, transform2DFromParts } from '../../godot/math/transform2d.js';
import type { DerivedProperties, StoredValue, StoredWrite } from './derivedProperty.js';

const DEG_TO_RAD = f(Math.PI) / 180;
const RAD_TO_DEG = 180 / f(Math.PI);

const real = (value: VariantValue) => (value as { value: number }).value;
const pair = (value: VariantValue) => {
  const [x, y] = (value as { value: readonly number[] }).value;
  return { x: x!, y: y! };
};
const floatValue = (value: number): VariantValue => ({ type: T.FLOAT, value: f(value) });
const vector2Value = ({ x, y }: { x: number; y: number }): VariantValue => ({
  type: T.VECTOR2,
  value: [x, y],
});

/** The stored properties `transform` is made of. */
const TRANSFORM_PARTS: ReadonlySet<string> = new Set(['position', 'rotation', 'scale', 'skew']);

/** Node2D's `rotation_degrees` and `transform`, over the stored position, rotation, scale and skew. */
export class Node2DProperties implements DerivedProperties {
  /** The transform `set_transform` keeps whole until a part is written (`node_2d.cpp:372-382`). */
  private transform: VariantValue | null = null;

  storedWritten(property: string): void {
    if (TRANSFORM_PARTS.has(property)) this.transform = null;
  }

  get(property: string, stored: StoredValue): VariantValue | undefined {
    switch (property) {
      case 'rotation_degrees':
        return floatValue(real(stored('rotation')) * RAD_TO_DEG);
      case 'transform': {
        if (this.transform) return this.transform;
        const t = transform2DFromParts(
          real(stored('rotation')),
          pair(stored('scale')),
          real(stored('skew')),
          pair(stored('position'))
        );
        return { type: T.TRANSFORM2D, value: [t.a, t.b, t.c, t.d, t.tx, t.ty] };
      }
    }
    return undefined;
  }

  set(property: string, value: VariantValue): readonly StoredWrite[] | undefined {
    switch (property) {
      case 'rotation_degrees':
        this.transform = null;
        return [['rotation', floatValue(real(value) * DEG_TO_RAD)]];
      case 'transform': {
        this.transform = value;
        const [a, b, c, d, tx, ty] = (value as { value: readonly number[] }).value;
        const parts = transform2DDecompose({ a: a!, b: b!, c: c!, d: d!, tx: tx!, ty: ty! });
        return [
          ['position', vector2Value(parts.position)],
          ['rotation', floatValue(parts.rotation)],
          ['scale', vector2Value(parts.scale)],
          ['skew', floatValue(parts.skew)],
        ];
      }
    }
    return undefined;
  }
}
