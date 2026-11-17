import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import { storedReal as f } from '../../godot/math/real.js';
import {
  basisFromQuaternionScale,
  basisGetRotationQuaternion,
  basisGetScale,
  type BasisComponents,
} from '../../godot/math/basis.js';
import {
  basisFromEulerScale,
  basisGetEulerNormalized,
  EulerOrder,
  type EulerAngles,
} from '../../godot/math/euler.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import type { DerivedProperties, StoredValue, StoredWrite } from './derivedProperty.js';

type Order = EnumValue<typeof EulerOrder>;

/** `Node3D::DirtyFlags` (`node_3d.h:83-89`): which of the transform and the Euler cache is stale. */
type Dirty = 'none' | 'local' | 'euler';

const DEG_TO_RAD = f(Math.PI) / 180;
const RAD_TO_DEG = 180 / f(Math.PI);

function vector3(value: VariantValue): EulerAngles {
  const [x, y, z] = (value as { value: readonly number[] }).value;
  return [x!, y!, z!];
}

const vector3Value = (v: readonly number[]): VariantValue => ({ type: T.VECTOR3, value: v.map(f) });

/**
 * Node3D's `position`, `rotation`, `rotation_degrees`, `scale`, `quaternion` and `basis`, over the
 * stored `transform`, with the Euler and scale cache Godot keeps between setters (`node_3d.cpp:86-97`).
 */
export class Node3DProperties implements DerivedProperties {
  /** Written by the setters below. Read from the stored `transform` while `dirty` is not `local`. */
  private basis: BasisComponents | null = null;
  private origin: readonly number[] | null = null;
  private euler: EulerAngles = [0, 0, 0];
  private scale: EulerAngles = [1, 1, 1];
  private dirty: Dirty = 'euler';

  storedWritten(property: string): void {
    if (property !== 'transform' && property !== 'rotation_order') return;
    this.basis = null;
    this.origin = null;
    this.dirty = 'euler';
  }

  get(property: string, stored: StoredValue): VariantValue | undefined {
    switch (property) {
      case 'position':
        return vector3Value(this.originOf(stored));
      case 'rotation':
        return vector3Value(this.rotationOf(stored));
      case 'rotation_degrees':
        return vector3Value(this.rotationOf(stored).map((angle) => f(angle * RAD_TO_DEG)));
      case 'scale':
        return vector3Value(this.scaleOf(stored));
      case 'quaternion': {
        const { x, y, z, w } = basisGetRotationQuaternion(this.basisOf(stored));
        return { type: T.QUATERNION, value: [x, y, z, w] };
      }
      case 'basis':
        return { type: T.BASIS, value: this.basisOf(stored) };
    }
    return undefined;
  }

  set(property: string, value: VariantValue, stored: StoredValue): readonly StoredWrite[] | undefined {
    switch (property) {
      case 'position':
        this.basis = this.basisOf(stored);
        this.origin = vector3(value);
        break;
      case 'rotation':
      case 'rotation_degrees': {
        const scale = this.dirty === 'euler' ? basisGetScale(this.basisOf(stored)) : this.scale;
        this.origin = this.originOf(stored);
        const angles = vector3(value);
        this.euler = property === 'rotation' ? angles : toRadians(angles);
        this.scale = scale;
        this.dirty = 'local';
        break;
      }
      case 'scale': {
        const euler = this.dirty === 'euler' ? this.eulerOfBasis(stored) : this.euler;
        this.origin = this.originOf(stored);
        this.euler = euler;
        this.scale = vector3(value);
        this.dirty = 'local';
        break;
      }
      case 'quaternion': {
        const scale = this.dirty === 'euler' ? basisGetScale(this.basisOf(stored)) : this.scale;
        const [x, y, z, w] = (value as { value: readonly number[] }).value;
        this.origin = this.originOf(stored);
        this.basis = basisFromQuaternionScale(
          { x: x!, y: y!, z: z!, w: w! },
          { x: scale[0], y: scale[1], z: scale[2] }
        );
        this.scale = scale;
        this.euler = basisGetEulerNormalized(this.basis, orderOf(stored));
        this.dirty = 'none';
        break;
      }
      case 'basis':
        this.origin = this.originOf(stored);
        this.basis = (value as { value: readonly number[] }).value as unknown as BasisComponents;
        this.dirty = 'euler';
        break;
      default:
        return undefined;
    }
    return [
      ['transform', { type: T.TRANSFORM3D, value: [...this.basisOf(stored), ...this.originOf(stored)] }],
    ];
  }

  private storedTransform(stored: StoredValue): readonly number[] {
    return (stored('transform') as { value: readonly number[] }).value;
  }

  private originOf(stored: StoredValue): readonly number[] {
    return this.origin ?? this.storedTransform(stored).slice(9);
  }

  /** `Node3D::get_transform` (`node_3d.cpp:402-407`): the basis built again from the cache where it is newer. */
  private basisOf(stored: StoredValue): BasisComponents {
    if (this.dirty === 'local') {
      this.basis = basisFromEulerScale(this.euler, this.scale, orderOf(stored));
      this.dirty = 'none';
    }
    return this.basis ?? (this.storedTransform(stored).slice(0, 9) as unknown as BasisComponents);
  }

  private eulerOfBasis(stored: StoredValue): EulerAngles {
    return basisGetEulerNormalized(this.basisOf(stored), orderOf(stored));
  }

  /** `_update_rotation_and_scale` (`node_3d.cpp:92-97`) where the cache is stale. */
  private refreshCache(stored: StoredValue): void {
    if (this.dirty !== 'euler') return;
    const basis = this.basisOf(stored);
    this.scale = basisGetScale(basis);
    this.euler = basisGetEulerNormalized(basis, orderOf(stored));
    this.dirty = 'none';
  }

  private rotationOf(stored: StoredValue): EulerAngles {
    this.refreshCache(stored);
    return this.euler;
  }

  private scaleOf(stored: StoredValue): EulerAngles {
    this.refreshCache(stored);
    return this.scale;
  }
}

function toRadians([x, y, z]: EulerAngles): EulerAngles {
  return [f(x * DEG_TO_RAD), f(y * DEG_TO_RAD), f(z * DEG_TO_RAD)];
}

function orderOf(stored: StoredValue): Order {
  return (stored('rotation_order') as { value: number }).value as Order;
}
