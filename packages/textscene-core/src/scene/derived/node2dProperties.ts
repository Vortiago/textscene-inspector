import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import { storedReal as f } from '../../godot/math/real.js';
import {
  affineInverseTransform2D,
  multiplyTransform2D,
  transform2DDecompose,
  transform2DFromParts,
  transform2DGetRotation,
  transform2DGetScale,
  transform2DGetSkew,
  transform2DSetRotation,
  transform2DSetScale,
  transform2DSetSkew,
  transform2DXform,
  type Transform2DColumns,
} from '../../godot/math/transform2d.js';
import { descendsFromClass } from '../../godot/classdb/classBaseTypes.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';

/** `Math::deg_to_rad(float)` and `Math::rad_to_deg(float)` multiply by a float constant (`math_funcs.h`). */
const DEG_TO_RAD = f(f(Math.PI) / 180);
const RAD_TO_DEG = f(180 / f(Math.PI));

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

function transformOf(value: VariantValue): Transform2DColumns {
  const [a, b, c, d, tx, ty] = (value as { value: readonly number[] }).value;
  return { a: a!, b: b!, c: c!, d: d!, tx: tx!, ty: ty! };
}

const transformValue = ({ a, b, c, d, tx, ty }: Transform2DColumns): VariantValue => ({
  type: T.TRANSFORM2D,
  value: [a, b, c, d, tx, ty],
});

/** The stored properties `transform` is made of. */
const TRANSFORM_PARTS: ReadonlySet<string> = new Set(['position', 'rotation', 'scale', 'skew']);

/** The global properties, each read from `get_global_transform` (`node_2d.cpp:289-370`). */
const GLOBAL_PROPERTIES: ReadonlySet<string> = new Set([
  'global_transform',
  'global_position',
  'global_rotation',
  'global_rotation_degrees',
  'global_skew',
  'global_scale',
]);

/** Node2D's `rotation_degrees`, `transform` and global properties, over the stored parts. */
export class Node2DProperties implements DerivedProperties {
  /** The transform `set_transform` keeps whole until a part is written (`node_2d.cpp:372-382`). */
  private transform: VariantValue | null = null;

  storedWritten(property: string): void {
    if (TRANSFORM_PARTS.has(property)) this.transform = null;
  }

  get(property: string, reads: NodeReads): VariantValue | undefined {
    switch (property) {
      case 'rotation_degrees':
        return floatValue(real(reads.stored('rotation')) * RAD_TO_DEG);
      case 'transform':
        return transformValue(this.localOf(reads));
    }
    if (!GLOBAL_PROPERTIES.has(property)) return undefined;
    const global = this.globalOf(reads);
    return global && globalPropertyOf(property, global);
  }

  set(property: string, value: VariantValue, reads: NodeReads): readonly StoredWrite[] | undefined {
    switch (property) {
      case 'rotation_degrees':
        this.transform = null;
        return [['rotation', floatValue(real(value) * DEG_TO_RAD)]];
      case 'transform':
        return this.setTransform(transformOf(value));
    }
    if (!GLOBAL_PROPERTIES.has(property)) return undefined;
    const parent = this.parentGlobalOf(reads);
    if (parent === undefined) return undefined;
    return parent ? this.setUnderParent(property, value, parent, reads) : this.setAtRoot(property, value);
  }

  /** `set_transform`: the parts read back from the whole transform, which stays as it was given. */
  private setTransform(transform: Transform2DColumns): readonly StoredWrite[] {
    this.transform = transformValue(transform);
    const parts = transform2DDecompose(transform);
    return [
      ['position', vector2Value(parts.position)],
      ['rotation', floatValue(parts.rotation)],
      ['scale', vector2Value(parts.scale)],
      ['skew', floatValue(parts.skew)],
    ];
  }

  /** A global setter with no parent item: the local setter of the same part. */
  private setAtRoot(property: string, value: VariantValue): readonly StoredWrite[] {
    if (property === 'global_transform') return this.setTransform(transformOf(value));
    this.transform = null;
    if (property === 'global_rotation_degrees') return [['rotation', floatValue(real(value) * DEG_TO_RAD)]];
    return [[property.slice('global_'.length), value]];
  }

  /** `node_2d.cpp:294-392`: the part set in global space, then read back through the parent's inverse. */
  private setUnderParent(
    property: string,
    value: VariantValue,
    parent: Transform2DColumns,
    reads: NodeReads
  ): readonly StoredWrite[] {
    const inverse = affineInverseTransform2D(parent);
    if (property === 'global_transform')
      return this.setTransform(multiplyTransform2D(inverse, transformOf(value)));
    this.transform = null;
    if (property === 'global_position')
      return [['position', vector2Value(transform2DXform(inverse, pair(value)))]];
    const global = multiplyTransform2D(parent, this.localOf(reads));
    const local = (changed: Transform2DColumns) => multiplyTransform2D(inverse, changed);
    switch (property) {
      case 'global_scale':
        return [
          ['scale', vector2Value(transform2DGetScale(local(transform2DSetScale(global, pair(value)))))],
        ];
      case 'global_skew':
        return [['skew', floatValue(transform2DGetSkew(local(transform2DSetSkew(global, real(value)))))]];
      default: {
        const radians = property === 'global_rotation' ? real(value) : f(real(value) * DEG_TO_RAD);
        return [
          ['rotation', floatValue(transform2DGetRotation(local(transform2DSetRotation(global, radians))))],
        ];
      }
    }
  }

  private localOf({ stored }: NodeReads): Transform2DColumns {
    if (this.transform) return transformOf(this.transform);
    return transform2DFromParts(
      real(stored('rotation')),
      pair(stored('scale')),
      real(stored('skew')),
      pair(stored('position'))
    );
  }

  /** `get_global_transform` (`canvas_item.cpp:176-194`), or undefined where a getter above is unported. */
  private globalOf(reads: NodeReads): Transform2DColumns | undefined {
    const parent = this.parentGlobalOf(reads);
    if (parent === undefined) return undefined;
    return parent ? multiplyTransform2D(parent, this.localOf(reads)) : this.localOf(reads);
  }

  /** `get_parent_item`'s global transform (`canvas_item.cpp:565-572`). A Control's needs the layout. */
  private parentGlobalOf(reads: NodeReads): Transform2DColumns | null | undefined {
    if ((reads.stored('top_level') as { value: unknown }).value === true) return null;
    const parent = reads.parent();
    if (!parent || !isCanvasItem(parent.type)) return null;
    const global = parent.get('global_transform');
    return global && transformOf(global);
  }
}

const isCanvasItem = (className: string) => descendsFromClass(className, 'CanvasItem');

function globalPropertyOf(property: string, global: Transform2DColumns): VariantValue {
  switch (property) {
    case 'global_transform':
      return transformValue(global);
    case 'global_position':
      return vector2Value({ x: global.tx, y: global.ty });
    case 'global_rotation':
      return floatValue(transform2DGetRotation(global));
    case 'global_rotation_degrees':
      return floatValue(transform2DGetRotation(global) * RAD_TO_DEG);
    case 'global_skew':
      return floatValue(transform2DGetSkew(global));
    default:
      return vector2Value(transform2DGetScale(global));
  }
}
