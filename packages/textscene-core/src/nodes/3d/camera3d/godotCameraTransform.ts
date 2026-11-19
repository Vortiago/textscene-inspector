import type * as THREE from 'three';
import { basisIsOrthonormal, basisOrthonormalized, type BasisComponents } from '../../../godot/math/basis.js';

/** The basis of a three matrix in the row-major order of a `Transform3D` literal. */
function basisOf({ elements: e }: THREE.Matrix4): BasisComponents {
  return [e[0]!, e[4]!, e[8]!, e[1]!, e[5]!, e[9]!, e[2]!, e[6]!, e[10]!];
}

/** `Camera3D::_get_adjusted_camera_transform` (camera_3d.cpp:253-258) on a world matrix. False: unchanged. */
export function adjustCameraTransform(world: THREE.Matrix4, hOffset: number, vOffset: number): boolean {
  const basis = basisOf(world);
  if (hOffset === 0 && vOffset === 0 && basisIsOrthonormal(basis)) return false;
  const [xx, yx, zx, xy, yy, zy, xz, yz, zz] = basisOrthonormalized(basis);
  const e = world.elements;
  world.set(
    xx,
    yx,
    zx,
    e[12]! + xx * hOffset + yx * vOffset,
    xy,
    yy,
    zy,
    e[13]! + xy * hOffset + yy * vOffset,
    xz,
    yz,
    zz,
    e[14]! + xz * hOffset + yz * vOffset,
    0,
    0,
    0,
    1
  );
  return true;
}
