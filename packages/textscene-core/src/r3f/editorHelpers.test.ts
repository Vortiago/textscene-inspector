import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { editorHelperUserData, isEditorHelper, markEditorHelper } from './editorHelpers';

describe('markEditorHelper', () => {
  it('marks an object as editor chrome', () => {
    const helper = new THREE.BoxHelper(new THREE.Mesh());
    markEditorHelper(helper);

    expect(isEditorHelper(helper)).toBe(true);
  });

  it('keeps the userData the object already holds (edge case)', () => {
    const object = new THREE.Group();
    object.userData.godotLayers = 2;
    markEditorHelper(object);

    expect(object.userData.godotLayers).toBe(2);
  });
});

describe('editorHelperUserData', () => {
  it('marks the element R3F hands it to', () => {
    const group = new THREE.Group();
    group.userData = editorHelperUserData();

    expect(isEditorHelper(group)).toBe(true);
  });
});

describe('isEditorHelper', () => {
  it('is false for an untagged object (error case)', () => {
    expect(isEditorHelper(new THREE.Mesh())).toBe(false);
  });

  it('is false for the child of a helper, as the tag marks only the root (edge case)', () => {
    const helper = new THREE.Group();
    const line = new THREE.LineSegments();
    helper.add(line);
    markEditorHelper(helper);

    expect(isEditorHelper(line)).toBe(false);
  });
});
