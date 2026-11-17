import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import { storedReal as f } from '../../godot/math/real.js';
import {
  basisDiagonal,
  basisFromQuaternionScale,
  basisGetRotationQuaternion,
  basisGetScale,
  basisMultiply,
  type BasisComponents,
} from '../../godot/math/basis.js';
import {
  basisFromEuler,
  basisFromEulerScale,
  basisGetEulerNormalized,
  EulerOrder,
  type EulerAngles,
} from '../../godot/math/euler.js';
import {
  affineInverseTransform3D,
  basisOfTransform3D,
  multiplyTransform3D,
  transform3DOf,
  type Transform3D,
} from '../../godot/math/transform3d.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';
import { descendsFromClass } from '../../godot/classdb/classBaseTypes.js';
import { degToRadf, radToDegf } from '../../godot/math/math.js';
import { isTrue } from './valueOf.js';
import type { DerivedProperties, NodeReads, StoredValue, StoredWrite } from './derivedProperty.js';

type Order = EnumValue<typeof EulerOrder>;

/** `Node3D::DirtyFlags` (`node_3d.h:83-89`): which of the transform and the Euler cache is stale. */
type Dirty = 'none' | 'local' | 'euler';

function vector3(value: VariantValue): EulerAngles {
  const [x, y, z] = (value as { value: readonly number[] }).value;
  return [x!, y!, z!];
}

const vector3Value = (v: readonly number[]): VariantValue => ({ type: T.VECTOR3, value: v.map(f) });

/** The order `get_euler_normalized` and `from_euler` take by default (`basis.h:74,85`). */
const DEFAULT_ORDER = EulerOrder.YXZ;

function transformOf(value: VariantValue): Transform3D {
  const n = (value as { value: readonly number[] }).value;
  return transform3DOf(n.slice(0, 9) as unknown as BasisComponents, { x: n[9]!, y: n[10]!, z: n[11]! });
}

function transformValue(transform: Transform3D): VariantValue {
  const { x, y, z } = transform.origin;
  return { type: T.TRANSFORM3D, value: [...basisOfTransform3D(transform), x, y, z] };
}

/** Node3D's derived transform properties, with Godot's Euler and scale cache (`node_3d.cpp:86-97`). */
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

  get(property: string, reads: NodeReads): VariantValue | undefined {
    const { stored } = reads;
    switch (property) {
      case 'position':
        return vector3Value(this.originOf(stored));
      case 'rotation':
        return vector3Value(this.rotationOf(stored));
      case 'rotation_degrees':
        return vector3Value(this.rotationOf(stored).map(radToDegf));
      case 'scale':
        return vector3Value(this.scaleOf(stored));
      case 'quaternion': {
        const { x, y, z, w } = basisGetRotationQuaternion(this.basisOf(stored));
        return { type: T.QUATERNION, value: [x, y, z, w] };
      }
      case 'basis':
        return { type: T.BASIS, value: this.basisOf(stored) };
    }
    return this.getGlobal(property, reads);
  }

  /** `node_3d.cpp:334-367`: each global property read from `get_global_transform`. */
  private getGlobal(property: string, reads: NodeReads): VariantValue | undefined {
    if (!GLOBAL_PROPERTIES.has(property)) return undefined;
    const global = this.globalOf(reads);
    if (!global) return undefined;
    const basis = basisOfTransform3D(global);
    switch (property) {
      case 'global_transform':
        return transformValue(global);
      case 'global_basis':
        return { type: T.BASIS, value: basis };
      case 'global_position':
        return vector3Value([global.origin.x, global.origin.y, global.origin.z]);
      case 'global_rotation':
        return vector3Value(basisGetEulerNormalized(basis, DEFAULT_ORDER));
      default:
        return vector3Value(basisGetEulerNormalized(basis, DEFAULT_ORDER).map(radToDegf));
    }
  }

  set(property: string, value: VariantValue, reads: NodeReads): readonly StoredWrite[] | undefined {
    const { stored } = reads;
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
      default: {
        const global = this.globalWritten(property, value, reads);
        if (!global) return undefined;
        this.setGlobalTransform(global, reads);
      }
    }
    return [
      ['transform', { type: T.TRANSFORM3D, value: [...this.basisOf(stored), ...this.originOf(stored)] }],
    ];
  }

  /** The global transform a global setter asks for (`node_3d.cpp:344-380`), or undefined. */
  private globalWritten(property: string, value: VariantValue, reads: NodeReads): Transform3D | undefined {
    if (property === 'global_transform') return transformOf(value);
    if (!GLOBAL_PROPERTIES.has(property)) return undefined;
    const global = this.globalOf(reads);
    if (!global) return undefined;
    switch (property) {
      case 'global_position': {
        const [x, y, z] = vector3(value);
        return { ...global, origin: { x, y, z } };
      }
      case 'global_basis':
        return transform3DOf(
          (value as { value: readonly number[] }).value as unknown as BasisComponents,
          global.origin
        );
      default: {
        const angles = property === 'global_rotation' ? vector3(value) : toRadians(vector3(value));
        const [sx, sy, sz] = basisGetScale(basisOfTransform3D(global));
        const basis = basisMultiply(basisFromEuler(angles, DEFAULT_ORDER), basisDiagonal(sx, sy, sz));
        return transform3DOf(basis, global.origin);
      }
    }
  }

  /** `set_global_transform` (`node_3d.cpp:413-420`): the parent's inverse taken off, then `set_transform`. */
  private setGlobalTransform(global: Transform3D, reads: NodeReads): void {
    const parent = this.parentGlobalOf(reads);
    const local = parent ? multiplyTransform3D(affineInverseTransform3D(parent), global) : global;
    this.basis = basisOfTransform3D(local);
    this.origin = [local.origin.x, local.origin.y, local.origin.z];
    this.dirty = 'euler';
  }

  /** `get_global_transform` (`node_3d.cpp:641-670`). `disable_scale` is no property, so no write sets it. */
  private globalOf(reads: NodeReads): Transform3D | undefined {
    const local = transform3DOf(this.basisOf(reads.stored), vectorOf(this.originOf(reads.stored)));
    const parent = this.parentGlobalOf(reads);
    if (parent === undefined) return undefined;
    return parent ? multiplyTransform3D(parent, local) : local;
  }

  /** The global transform of `data.parent`: null for a top-level node or a parent that is no Node3D. */
  private parentGlobalOf(reads: NodeReads): Transform3D | null | undefined {
    if (isTrue(reads.stored('top_level'))) return null;
    const parent = reads.parent();
    if (!parent || !descendsFromClass(parent.type, 'Node3D')) return null;
    const global = parent.get('global_transform');
    return global && transformOf(global);
  }

  private storedTransform(stored: StoredValue): readonly number[] {
    return (stored('transform') as { value: readonly number[] }).value;
  }

  private originOf(stored: StoredValue): readonly number[] {
    return this.origin ?? this.storedTransform(stored).slice(9);
  }

  /** `node_3d.cpp:402-407`: the basis built again from the cache where the cache is newer. */
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
  return [degToRadf(x), degToRadf(y), degToRadf(z)];
}

/** Every global property this family ports, read through the parent's global transform. */
const GLOBAL_PROPERTIES: ReadonlySet<string> = new Set([
  'global_transform',
  'global_basis',
  'global_position',
  'global_rotation',
  'global_rotation_degrees',
]);

const vectorOf = ([x, y, z]: readonly number[]) => ({ x: x!, y: y!, z: z! });

function orderOf(stored: StoredValue): Order {
  return (stored('rotation_order') as { value: number }).value as Order;
}
