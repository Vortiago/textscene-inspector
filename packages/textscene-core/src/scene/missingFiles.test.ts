import { describe, expect, it } from 'vitest';
import { missingResourcesOf } from './missingFiles';
import { openScene } from './openScene';

const EMPTY_SCENE = '[gd_scene format=3]\n\n[node name="Root" type="Node"]\n';

describe('the missing files of a scene', () => {
  it('names the file of a sub-resource a view reported', () => {
    const scene = openScene({ source: EMPTY_SCENE, provider: { loadResource: async () => null } });
    missingResourcesOf(scene).report('res://materials.tres::Material_1');
    missingResourcesOf(scene).report('res://materials.tres::Material_2');
    expect([...scene.missingFiles()]).toEqual(['res://materials.tres']);
  });
});
