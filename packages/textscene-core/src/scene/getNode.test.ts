import { describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene } from './openScene';
import { cachedUniqueNameOwnership } from '../utils/uniqueNames';
import type { ResourceProvider } from '../resources/ResourceProvider';

const MAIN = 'res://main.tscn';

const filesOf = (files: Record<string, string>): ResourceProvider => ({
  loadResource: async (path) => files[path] ?? null,
});

const LEVEL = `[gd_scene format=3]

[node name="Level" type="Node3D"]

[node name="Player" type="Node3D" parent="."]

[node name="Camera" type="Camera3D" parent="Player"]

[node name="HUD" type="Control" parent="."]

[node name="Score" type="Label" parent="HUD"]
unique_name_in_owner = true
`;

const ENEMY = `[gd_scene format=3]

[node name="Enemy" type="Node3D"]

[node name="Body" type="MeshInstance3D" parent="."]
unique_name_in_owner = true
`;

const WITH_ENEMY = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Level" type="Node3D"]

[node name="Enemy" parent="." instance=ExtResource("1")]
`;

const levelScene = () => openScene({ source: LEVEL, provider: filesOf({}), rootScenePath: MAIN });

describe('getNode', () => {
  it('finds a node by a path relative to the root node', () => {
    expect(levelScene().getNode('Player/Camera').type).toBe('Camera3D');
  });

  it('gives the absolute path get_path gives', () => {
    expect(levelScene().getNode('Player/Camera').path).toBe('/root/Level/Player/Camera');
  });

  it('walks up with ..', () => {
    expect(levelScene().getNode('Player').getNode('../HUD/Score').name).toBe('Score');
  });

  it('finds a %Name of the scene', () => {
    expect(levelScene().getNode('%Score').path).toBe('/root/Level/HUD/Score');
  });

  it('starts an absolute path at the root window', () => {
    const scene = levelScene();
    expect(scene.getNode('/root').type).toBe('Window');
    expect(scene.getNode('/root/Level/Player').name).toBe('Player');
  });

  it('throws Godot message for a miss', () => {
    expect(() => levelScene().getNode('Player/Gun')).toThrow(
      'Node not found: "Player/Gun" (relative to "/root/Level").'
    );
  });

  it('answers null for a miss with getNodeOrNull', () => {
    expect(levelScene().getNodeOrNull('Nowhere')).toBeNull();
  });

  it('gives one handle for two lookups of one node', () => {
    const scene = levelScene();
    expect(scene.getNode('Player')).toBe(scene.getNode('%Score').getNode('../../Player'));
  });

  it('walks to the parent and the children', () => {
    const scene = levelScene();
    const player = scene.getNode('Player');
    expect(player.getParent()?.name).toBe('Level');
    expect(
      scene
        .getNode('.')
        .getChildren()
        .map((child) => child.name)
    ).toEqual(['Player', 'HUD']);
  });
});

describe('getNode in a sub-scene', () => {
  const sceneWithEnemy = () =>
    openScene({ source: WITH_ENEMY, provider: filesOf({ 'res://enemy.tscn': ENEMY }), rootScenePath: MAIN });

  it('finds no node of a sub-scene before it loads', () => {
    expect(sceneWithEnemy().getNodeOrNull('Enemy/Body')).toBeNull();
  });

  it('lists no child of a sub-scene that has not loaded, as find gives none', () => {
    expect(
      sceneWithEnemy()
        .getNode('.')
        .getChildren()
        .map((child) => child.name)
    ).toEqual([]);
  });

  it('finds the node once the sub-scene loads', async () => {
    const scene = sceneWithEnemy();
    scene.getNodeOrNull('Enemy');
    await vi.waitFor(() => expect(scene.getNodeOrNull('Enemy/Body')?.type).toBe('MeshInstance3D'));
  });

  it('finds a %Name through the instance that owns it', async () => {
    const scene = sceneWithEnemy();
    scene.getNodeOrNull('Enemy');
    await vi.waitFor(() =>
      expect(scene.getNode('Enemy').getNodeOrNull('%Body')?.path).toBe('/root/Level/Enemy/Body')
    );
  });

  it('tells a tree observer nothing when a lookup passes a sub-scene that failed to load', async () => {
    const scene = openScene({ source: WITH_ENEMY, provider: filesOf({}), rootScenePath: MAIN });
    const listener = vi.fn();
    scene.observe(null, listener);
    scene.getNodeOrNull('Enemy');
    await vi.waitFor(() => expect(listener).toHaveBeenCalled());
    listener.mockClear();

    scene.getNodeOrNull('Enemy/Body');

    expect(listener).not.toHaveBeenCalled();
  });

  it('tells a tree observer when the sub-scene loads', async () => {
    const scene = sceneWithEnemy();
    const listener = vi.fn();
    scene.observe(null, listener);
    scene.getNodeOrNull('Enemy');
    await vi.waitFor(() => expect(listener).toHaveBeenCalled());
  });
});

describe('the scene after a write', () => {
  it('keeps the %Name claims of the parse, as a view reads them', async () => {
    const scene = levelScene();
    await scene.getNode('Player').set('visible', false);
    const written = scene.written()?.scenes.get(MAIN)?.nodes ?? [];
    expect(cachedUniqueNameOwnership(written).claims.has('%Score')).toBe(true);
  });
});

describe('a node handle after a new text', () => {
  it('answers that it left the tree', () => {
    const scene = levelScene();
    const player = scene.getNode('Player');
    scene.setSource(LEVEL.replace('[node name="HUD"', '[node name="Menu"'));
    expect(player.isInsideTree()).toBe(false);
  });

  it('refuses a write', async () => {
    const scene = levelScene();
    const player = scene.getNode('Player');
    scene.setSource(`${LEVEL}\n`);
    await expect(player.set('visible', false)).rejects.toThrow(/freed by a new text/);
  });
});

describe('a lookup of a node an instance seats', () => {
  const HUD = `[gd_scene format=3]

[node name="Hud" type="Node3D"]
`;

  const HOST = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://hud.tscn" id="hud"]

[node name="Main" type="Node3D"]

[node name="HudInstance" parent="." instance=ExtResource("hud")]

[node name="Lamp" type="Node3D" parent="." owner="HudInstance"]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="HudInstance/%Lamp"]

[editable path="HudInstance"]
`;

  it('loads the sibling instance a heading walks into, so the node it seats is found', async () => {
    const files: Record<string, string> = { 'res://hud.tscn': HUD };
    const scene = openScene({
      source: HOST,
      provider: { loadResource: async (path) => files[path] ?? null },
    });

    await vi.waitFor(() => expect(scene.getNodeOrNull('/root/Main/Lamp/Shade')).not.toBeNull());
  });
});
