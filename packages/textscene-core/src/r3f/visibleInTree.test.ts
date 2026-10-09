import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { visibleInTree } from './visibleInTree';

function parented(): THREE.Group {
  const root = new THREE.Group();
  const child = new THREE.Group();
  root.add(child);
  return child;
}

describe('visibleInTree', () => {
  it('is true for a visible object under a visible parent', () => {
    expect(visibleInTree(parented())).toBe(true);
  });

  it('is false when the object itself is hidden', () => {
    const child = parented();
    child.visible = false;
    expect(visibleInTree(child)).toBe(false);
  });

  it('is false when an ancestor is hidden (edge case)', () => {
    const child = parented();
    child.parent!.visible = false;
    expect(visibleInTree(child)).toBe(false);
  });
});
