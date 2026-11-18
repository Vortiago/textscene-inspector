import { descendsFromClass } from '../../godot/classdb/classBaseTypes.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import type { DerivedProperties, NodeReads, StoredWrite } from './derivedProperty.js';
import { AutoTranslateProperties } from './autoTranslateProperties.js';
import { CapsuleMidHeightProperties } from './capsuleMidHeightProperties.js';
import { ControlProperties } from './controlProperties.js';
import { FrameCoordsProperties } from './frameCoordsProperties.js';
import { LightmapScaleProperties } from './lightmapScaleProperties.js';
import { MemberProperties } from './memberProperties.js';
import { Node2DProperties } from './node2dProperties.js';
import { Node3DProperties } from './node3dProperties.js';
import { RenamedProperties } from './renamedProperties.js';
import { VideoVolumeProperties } from './videoVolumeProperties.js';
import { VolumeLinearProperties } from './volumeLinearProperties.js';
import { boolValue, realValue } from './valueOf.js';

/** Each ported family, with the class whose descendants take it. A class may take several. */
const FAMILIES: readonly (readonly [baseClass: string, create: () => DerivedProperties])[] = [
  ['Node3D', () => new Node3DProperties()],
  ['Node2D', () => new Node2DProperties()],
  ['Control', () => new ControlProperties()],
  ['Control', () => new AutoTranslateProperties()],
  ['Window', () => new AutoTranslateProperties()],
  ['Sprite2D', () => new FrameCoordsProperties()],
  ['Sprite3D', () => new FrameCoordsProperties()],
  ['AudioStreamPlayer', () => new VolumeLinearProperties()],
  ['AudioStreamPlayer2D', () => new VolumeLinearProperties()],
  ['AudioStreamPlayer3D', () => new VolumeLinearProperties()],
  ['VideoStreamPlayer', () => new VideoVolumeProperties()],
  ['GeometryInstance3D', () => new LightmapScaleProperties()],
  ['SpringBoneCollisionCapsule3D', () => new CapsuleMidHeightProperties()],
  ['SkeletonIK3D', () => new RenamedProperties(new Map([['interpolation', 'influence']]))],
  // The initial value of each field, from its class header.
  [
    'VisualInstance3D',
    () =>
      new MemberProperties(
        new Map([
          ['sorting_offset', realValue(0)],
          ['sorting_use_aabb_center', boolValue(true)],
        ])
      ),
  ],
  ['CSGShape3D', () => new MemberProperties(new Map([['snap', realValue(0.001)]]))],
  ['Timer', () => new MemberProperties(new Map([['paused', boolValue(false)]]))],
];

/** The ported families of a class, as one, or null where none is ported yet. */
export function derivedPropertiesOf(className: string): DerivedProperties | null {
  const families = FAMILIES.filter(([base]) => descendsFromClass(className, base)).map(([, create]) =>
    create()
  );
  if (families.length === 0) return null;
  return families.length === 1 ? families[0]! : new DerivedFamilies(families);
}

/** Several families of one class: the first that ports a name answers for it. */
class DerivedFamilies implements DerivedProperties {
  constructor(private readonly families: readonly DerivedProperties[]) {}

  get(property: string, reads: NodeReads): VariantValue | undefined {
    for (const family of this.families) {
      const value = family.get(property, reads);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  set(property: string, value: VariantValue, reads: NodeReads): readonly StoredWrite[] | undefined {
    for (const family of this.families) {
      const writes = family.set(property, value, reads);
      if (writes !== undefined) return writes;
    }
    return undefined;
  }

  storedWritten(property: string): void {
    for (const family of this.families) family.storedWritten?.(property);
  }
}
