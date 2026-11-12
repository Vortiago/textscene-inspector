import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { drawAtNodePose } from './extraDrawPose';

/** A node at `nodeMatrix`, its posed object moved away from it, a surface below, and an extra draw on the surface. */
function posedScene(nodeMatrix: THREE.Matrix4 | null) {
  const posed = new THREE.Group();
  // A node billboard writes the world matrix itself and stops three recomputing it.
  posed.matrixWorldAutoUpdate = false;
  posed.matrixWorld.makeRotationY(Math.PI / 2);
  const surface = new THREE.Mesh();
  surface.position.set(1, 2, 3);
  const extra = new THREE.Mesh();
  posed.add(surface);
  surface.add(extra);
  const release = drawAtNodePose(extra, {
    instance: {
      isVisible: true,
      nodeMatrixWorld: (target) => {
        if (nodeMatrix) target.copy(nodeMatrix);
        return nodeMatrix !== null;
      },
    },
    posedRef: { current: posed },
  });
  posed.updateMatrixWorld(true);
  return { posed, surface, extra, release };
}

describe('drawAtNodePose', () => {
  it('keeps the draw under the node transform, not the moved one', () => {
    const node = new THREE.Matrix4().makeTranslation(10, 0, 0);
    const { extra } = posedScene(node);

    expect(new THREE.Vector3().setFromMatrixPosition(extra.matrixWorld).toArray()).toEqual([11, 2, 3]);
  });

  it('leaves the surface it covers where the moved object puts it', () => {
    const { surface } = posedScene(new THREE.Matrix4().makeTranslation(10, 0, 0));
    const position = new THREE.Vector3().setFromMatrixPosition(surface.matrixWorld);

    expect(position.x).toBeCloseTo(3);
    expect(position.z).toBeCloseTo(-1);
  });

  it('follows its parent while the node has no known transform', () => {
    const { surface, extra } = posedScene(null);

    expect(extra.matrixWorld.equals(surface.matrixWorld)).toBe(true);
  });

  it('follows its parent again once released', () => {
    const { posed, surface, extra, release } = posedScene(new THREE.Matrix4().makeTranslation(10, 0, 0));
    release();
    posed.updateMatrixWorld(true);

    expect(extra.matrixWorld.equals(surface.matrixWorld)).toBe(true);
  });
});
