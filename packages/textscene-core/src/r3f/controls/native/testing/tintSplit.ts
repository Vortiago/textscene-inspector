/**
 * Tells a painter's own parts from its internal child parts in a test. `splitTints` gives pure red to
 * `tint` and pure green to `childTint`, so a mesh drawn with one never carries the other's channel.
 */
import * as THREE from 'three';
import type ReactThreeTestRenderer from '@react-three/test-renderer';
import type { NativeControlComponentProps } from '../../ControlComponentRegistry';
import { painterTint } from './painterProps';
import { bundledRunOf } from './bundledRunStub';
import { drawnStyleBox } from './drawnStyleBox';

type Scene = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>['scene'];

/** The two tints of a painter test: red for the item's own pixels, green for a child's. */
export const splitTints: Pick<NativeControlComponentProps, 'tint' | 'childTint'> = {
  tint: painterTint({ r: 1, g: 0, b: 0, a: 1 }),
  childTint: painterTint({ r: 0, g: 1, b: 0, a: 1 }),
};

export interface TintSplit {
  /** Meshes and runs drawn with `tint`. */
  own: number;
  /** Meshes and runs drawn with `childTint`. */
  child: number;
}

/** The colour a mesh or a bundled run draws with, or null when it carries no tint-bearing colour. */
function drawnColor(mesh: THREE.Mesh): { r: number; g: number; b: number } | null {
  const run = bundledRunOf(mesh);
  if (run) return run.tint;
  const attribute = (mesh.geometry as THREE.BufferGeometry).attributes.color;
  if (attribute) {
    for (let i = 0; i < attribute.count; i++) {
      if (attribute.getX(i) + attribute.getY(i) + attribute.getZ(i) > 0.0001) {
        return { r: attribute.getX(i), g: attribute.getY(i), b: attribute.getZ(i) };
      }
    }
    return null;
  }
  const material = mesh.material as THREE.MeshBasicMaterial | undefined;
  return material?.color ?? null;
}

/**
 * How many meshes of `scene` took each tint. A mesh with both channels, or none, counts for neither:
 * the test then fails on a count it expected.
 */
export function countTintSplit(scene: Scene): TintSplit {
  const split: TintSplit = { own: 0, child: 0 };
  for (const found of scene.findAllByType('Mesh')) {
    const color = drawnColor(found.instance as THREE.Mesh);
    if (!color) continue;
    if (color.r > 0.0001 && color.g < 0.0001 && color.b < 0.0001) split.own++;
    else if (color.g > 0.0001 && color.r < 0.0001 && color.b < 0.0001) split.child++;
  }
  return split;
}

/** A white box with a 4 px content margin: any other colour times a pure tint of the other channel reads as black. */
export function whiteStyleBox() {
  return drawnStyleBox({
    bg_color: 'Color(1, 1, 1, 1)',
    content_margin_top: '4',
    content_margin_bottom: '4',
  });
}
