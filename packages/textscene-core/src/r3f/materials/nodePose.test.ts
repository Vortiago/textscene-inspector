import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { alignNodePose, nodePoseUniforms } from './nodePose';

function expectSameMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4): void {
  actual.elements.forEach((element, i) => expect(element).toBeCloseTo(expected.elements[i]!, 9));
}

describe('nodePoseUniforms', () => {
  it('gives each material its own pose', () => {
    expect(nodePoseUniforms(new THREE.MeshBasicMaterial())).not.toBe(
      nodePoseUniforms(new THREE.MeshBasicMaterial())
    );
  });

  it('keeps one pose for a material across recompiles (edge case)', () => {
    const material = new THREE.MeshBasicMaterial();
    expect(nodePoseUniforms(material)).toBe(nodePoseUniforms(material));
  });
});

describe('alignNodePose', () => {
  const node = new THREE.Matrix4().makeTranslation(1, 2, 3);
  const drawn = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(1, 2, 3);

  it('maps the drawn model to the node object space', () => {
    const material = new THREE.MeshBasicMaterial();
    const pose = nodePoseUniforms(material);

    alignNodePose(material, node, drawn);

    expectSameMatrix(pose.godotObjectFromModel.value, new THREE.Matrix4().makeRotationY(Math.PI / 2));
  });

  it('maps the node object space back to the drawn model', () => {
    const material = new THREE.MeshBasicMaterial();
    const pose = nodePoseUniforms(material);

    alignNodePose(material, node, drawn);

    expectSameMatrix(pose.godotModelFromObject.value, new THREE.Matrix4().makeRotationY(-Math.PI / 2));
  });

  it('is the identity where three draws in the node pose (edge case)', () => {
    const material = new THREE.MeshBasicMaterial();
    const pose = nodePoseUniforms(material);
    const posed = new THREE.Matrix4().makeRotationX(1).setPosition(4, 5, 6);

    alignNodePose(material, posed, posed);

    expectSameMatrix(pose.godotObjectFromModel.value, new THREE.Matrix4());
    expectSameMatrix(pose.godotModelFromObject.value, new THREE.Matrix4());
  });

  it('leaves a material whose programs read no pose alone (error case)', () => {
    const material = new THREE.MeshBasicMaterial();
    alignNodePose(material, new THREE.Matrix4(), new THREE.Matrix4().makeScale(2, 2, 2));

    expect(nodePoseUniforms(material).godotObjectFromModel.value.equals(new THREE.Matrix4())).toBe(true);
  });
});
