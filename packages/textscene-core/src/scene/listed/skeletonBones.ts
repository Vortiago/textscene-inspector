import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import type { Vector3 } from '../../godot/math/vector.js';
import type { Transform3D } from '../../godot/math/transform3d.js';
import { boneKeyOf } from '../../nodes/3d/skeleton3d/boneTable.js';
import { readBones } from '../../nodes/3d/skeleton3d/readBones.js';
import type { Bone } from '../../nodes/3d/skeleton3d/skeletonPose.js';
import { perObject } from '../../utils/perObject.js';
import { boolValue, intValue } from '../derived/valueOf.js';
import type { GetOutcome } from '../propertyAccess.js';
import type { ListedReads, NodeTexts } from './listedProperties.js';

const vector3Value = ({ x, y, z }: Vector3): VariantValue => ({ type: T.VECTOR3, value: [x, y, z] });

function transform3DValue({ basis_x, basis_y, basis_z, origin }: Transform3D): VariantValue {
  const rows = [basis_x, basis_y, basis_z, origin].flatMap(({ x, y, z }) => [x, y, z]);
  return { type: T.TRANSFORM3D, value: rows };
}

/** Each leaf `_get` has an arm for. `bone_meta` reads metadata, which no bone here keeps. */
const BONE_LEAVES: Readonly<Record<string, (bone: Bone) => VariantValue>> = {
  name: (bone) => ({ type: T.STRING, value: bone.name }),
  parent: (bone) => intValue(bone.parent),
  rest: (bone) => transform3DValue(bone.rest),
  enabled: (bone) => boolValue(bone.enabled),
  position: (bone) => vector3Value(bone.position),
  rotation: ({ rotation: { x, y, z, w } }) => ({ type: T.QUATERNION, value: [x, y, z, w] }),
  scale: (bone) => vector3Value(bone.scale),
};

/** One read of the texts for every bone name a lookup asks. */
const bonesOf = perObject((texts: NodeTexts) => readBones({ ...texts }));

/** `Skeleton3D::_get` of a `bones/<i>/<leaf>` name (skeleton_3d.cpp:141-180). */
export function skeletonBones(property: string, { texts }: ListedReads): GetOutcome {
  const key = boneKeyOf(property);
  if (!key) return { kind: 'unknown' };
  const bone = bonesOf(texts)[key.which];
  const leaf = Object.hasOwn(BONE_LEAVES, key.leaf) ? BONE_LEAVES[key.leaf] : undefined;
  // `ERR_FAIL_UNSIGNED_INDEX_V` past the last bone, and a leaf with no arm, return false (:157, :176).
  return bone && leaf ? { kind: 'value', value: leaf(bone) } : { kind: 'refused' };
}
