/**
 * A sub-scene is an instanced `.glb` when its only root is the synthesised GLB root, and only then
 * does a host's typed child attach into the GLB's nodes.
 */
import { describe, expect, it } from 'vitest';
import { GLB_SCENE_ROOT_TYPE, loneGlbRootPath } from './glbSceneRoot';

const glbRoot = (glbPath: string) => ({ type: GLB_SCENE_ROOT_TYPE, properties: { glbPath } });
const node3D = { type: 'Node3D', properties: {} };

describe('loneGlbRootPath', () => {
  it('names the GLB a lone GLB root loads', () => {
    expect(loneGlbRootPath([glbRoot('res://lamp.glb')])).toBe('res://lamp.glb');
  });

  it('names none for a lone root of another type', () => {
    expect(loneGlbRootPath([node3D])).toBeUndefined();
  });

  it('names none for a GLB root beside another root (edge case)', () => {
    expect(loneGlbRootPath([glbRoot('res://lamp.glb'), node3D])).toBeUndefined();
  });

  it('names none for a scene with no root (edge case)', () => {
    expect(loneGlbRootPath([])).toBeUndefined();
  });
});
