import { describe, expect, it } from 'vitest';
import { loaderServing } from '../testing/servingResourceLoader';
import type { ResourceLoader } from '../ResourceLoader';
import type { LoadOutcome } from './loadOutcome';

const ATLAS_SCENE = `[gd_scene format=3]
[ext_resource type="Texture2D" path="res://art/icon.png" id="1"]
[sub_resource type="AtlasTexture" id="a"]
atlas = ExtResource("1")
[node name="Root" type="Node2D"]
`;

const FAILING_TRES = `[gd_resource type="AtlasTexture" format=3]
[ext_resource type="Texture2D" path="res://art/icon.png" id="1"]
[resource]
atlas = ExtResource("1")
`;

async function outcomeOf(loader: ResourceLoader, path: string): Promise<LoadOutcome> {
  const loaded = loader.eventBus.once<LoadOutcome>('loadoutcome', 'loaded', path, 2000);
  loader.loadOutcomes.request(path);
  return loaded;
}

describe('ResourceLoader.loadOutcomes', () => {
  it('fails a scene whose [sub_resource] reads a missing file', async () => {
    const loader = loaderServing({ 'res://main.tscn': ATLAS_SCENE });

    expect(await outcomeOf(loader, 'res://main.tscn')).toEqual({
      isFailed: true,
      chain: ['res://main.tscn', 'res://art/icon.png'],
      cause: 'missing',
    });
  });

  it('loads a scene whose missing image has an import sidecar', async () => {
    const loader = loaderServing({ 'res://main.tscn': ATLAS_SCENE, 'res://art/icon.png.import': '' });

    expect(await outcomeOf(loader, 'res://main.tscn')).toEqual({ isFailed: false });
  });

  it('fails a scene through the .tres its [sub_resource] reads', async () => {
    const loader = loaderServing({
      'res://main.tscn': ATLAS_SCENE.replace('res://art/icon.png', 'res://atlas.tres'),
      'res://atlas.tres': FAILING_TRES,
    });

    expect(await outcomeOf(loader, 'res://main.tscn')).toMatchObject({
      chain: ['res://main.tscn', 'res://atlas.tres', 'res://art/icon.png'],
    });
  });

  it('loads the scene again once the missing file appears', async () => {
    const files: Record<string, string> = { 'res://main.tscn': ATLAS_SCENE, 'res://art/other.png': '' };
    const loader = loaderServing(files);
    await outcomeOf(loader, 'res://main.tscn');

    files['res://art/icon.png'] = '';
    loader.provideFile('res://art/icon.png');

    expect(await outcomeOf(loader, 'res://main.tscn')).toEqual({ isFailed: false });
  });
});
