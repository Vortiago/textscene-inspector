import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { editorHelperUserData, hideEditorHelpers, isEditorHelper, markEditorHelper } from './editorHelpers';

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

describe('hideEditorHelpers', () => {
  function sceneWithChrome() {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh();
    const chrome = new THREE.Group();
    chrome.userData = editorHelperUserData();
    chrome.add(new THREE.Mesh());
    scene.add(mesh, chrome);
    return { scene, mesh, chrome };
  }

  it('hides the chrome and leaves the scene content visible', () => {
    const { scene, mesh, chrome } = sceneWithChrome();
    hideEditorHelpers(scene);

    expect([mesh.visible, chrome.visible]).toEqual([true, false]);
  });

  it('shows the chrome again when the returned call runs', () => {
    const { scene, chrome } = sceneWithChrome();
    hideEditorHelpers(scene)();

    expect(chrome.visible).toBe(true);
  });

  it('keeps chrome the authored scene already hid hidden after the restore', () => {
    const { scene, chrome } = sceneWithChrome();
    chrome.visible = false;
    hideEditorHelpers(scene)();

    expect(chrome.visible).toBe(false);
  });
});
