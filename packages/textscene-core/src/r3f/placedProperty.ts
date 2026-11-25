import { VARIANT_TYPE as T } from '../godot/variant/variantType.js';
import type { VariantValue } from '../godot/variant/variantValue.js';
import { basisOfTransform3D, type Transform3D } from '../godot/math/transform3d.js';
import { storedReal as f } from '../godot/math/real.js';
import type { NodePatch } from './nodePatch.js';

type Vector2 = { readonly x: number; readonly y: number };

/** The Godot value of each property a placing pass writes: a relay's target pose, a solved bone's. */
const PLACED_VALUES: Readonly<Record<string, (patched: never) => VariantValue>> = {
  position: ({ x, y }: Vector2) => ({ type: T.VECTOR2, value: [f(x), f(y)] }),
  scale: ({ x, y }: Vector2) => ({ type: T.VECTOR2, value: [f(x), f(y)] }),
  rotation: (radians: number) => ({ type: T.FLOAT, value: f(radians) }),
  skew: (radians: number) => ({ type: T.FLOAT, value: f(radians) }),
  transform: (transform: Transform3D) => {
    const { x, y, z } = transform.origin;
    return { type: T.TRANSFORM3D, value: [...basisOfTransform3D(transform), x, y, z].map(f) };
  },
};

/** The value `patch` lays over the stored `property`, or undefined where it lays none. */
export function placedPropertyOf(patch: NodePatch | undefined, property: string): VariantValue | undefined {
  if (!patch || !Object.hasOwn(patch, property) || !Object.hasOwn(PLACED_VALUES, property)) return undefined;
  return PLACED_VALUES[property]!(patch[property] as never);
}
