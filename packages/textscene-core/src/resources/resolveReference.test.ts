import { describe, expect, it } from 'vitest';
import { parseTresFile, type ParsedResource } from '../parser/parsedResource';
import type { SceneResources } from '../r3f/SceneResourcesContext';
import { referencedFilePath, resolveReference } from './resolveReference';
import type { LoadedFile } from './scopedResource';
import { NO_FILES } from './testing/noFiles';

const CURVE_PATH = 'res://fade.tres';
const SCENE: SceneResources = {
  internalResources: [{ id: 'inline', type: 'Curve', data: {} }],
  externalResources: [
    { id: '1_curve', type: 'Curve', path: CURVE_PATH },
    { id: '2_scene', type: 'PackedScene', path: 'res://rock.glb' },
  ],
};

/** A Curve file that also holds a sub-resource its own `[resource]` could name. */
const CURVE_FILE = parseTresFile(
  `[gd_resource type="Curve" format=3]\n\n[sub_resource type="Gradient" id="Gradient_a"]\n\n[resource]\nbake_resolution = 50\n`
);
const loaded =
  (parsed: ParsedResource): LoadedFile =>
  (path) =>
    path === CURVE_PATH ? parsed : undefined;

describe('referencedFilePath', () => {
  it('is the path of an ExtResource that names a resource file', () => {
    expect(referencedFilePath('ExtResource("1_curve")', SCENE)).toBe(CURVE_PATH);
  });

  it('is null for a SubResource, no reference, and a file no processor reads', () => {
    expect(referencedFilePath('SubResource("inline")', SCENE)).toBeNull();
    expect(referencedFilePath(undefined, SCENE)).toBeNull();
    expect(referencedFilePath('ExtResource("2_scene")', SCENE)).toBeNull();
  });
});

describe('resolveReference', () => {
  it('resolves a SubResource against the scene’s tables, with no file loaded', () => {
    const scoped = resolveReference('SubResource("inline")', SCENE, NO_FILES);

    expect(scoped?.resource).toBe(SCENE.internalResources[0]);
    expect(scoped?.resources).toBe(SCENE);
  });

  it('resolves an ExtResource to the section of its loaded file, scoped to that file’s own tables', () => {
    const scoped = resolveReference('ExtResource("1_curve")', SCENE, loaded(CURVE_FILE));

    expect(scoped?.resource).toMatchObject({ type: 'Curve', data: { bake_resolution: '50' } });
    expect(scoped?.resources.internalResources).toBe(CURVE_FILE.subResources);
  });

  it('is null while the file has not loaded, or after it failed', () => {
    expect(resolveReference('ExtResource("1_curve")', SCENE, NO_FILES)).toBeNull();
  });

  it('is null for no reference, an unknown id, and a file no processor reads', () => {
    const files = loaded(CURVE_FILE);

    expect(resolveReference(undefined, SCENE, files)).toBeNull();
    expect(resolveReference('SubResource("missing")', SCENE, files)).toBeNull();
    expect(resolveReference('ExtResource("9")', SCENE, files)).toBeNull();
    expect(resolveReference('ExtResource("2_scene")', SCENE, files)).toBeNull();
  });
});
