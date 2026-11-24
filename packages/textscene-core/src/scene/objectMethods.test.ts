import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene } from './openScene';
import { variant } from './variant';
import type { ResourceProvider } from '../resources/ResourceProvider';

const provider: ResourceProvider = { loadResource: async () => null };

const SOURCE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Eye" type="Camera3D" parent="."]
`;

const eye = () => openScene({ source: SOURCE, provider }).getNode('Eye');

// Each answer is measured in Godot 4.6.3 on a Camera3D through `callv`.
describe('is_class', () => {
  it.each([
    ['Camera3D', true],
    ['Node3D', true],
    ['Object', true],
    ['Node2D', false],
    ['', false],
  ])('answers %j with %s', async (className, expected) => {
    expect(await eye().call('is_class', className)).toBe(expected);
  });

  it('takes a StringName', async () => {
    expect(await eye().call('is_class', variant('&"Node"'))).toBe(true);
  });

  it("throws Godot's error for an argument that is not a string", async () => {
    await expect(eye().call('is_class', 5)).rejects.toThrow(
      'Camera3D::is_class: Cannot convert argument 1 from int to String.'
    );
  });

  it("throws Godot's error for a node argument", async () => {
    const scene = openScene({ source: SOURCE, provider });
    await expect(scene.getNode('Eye').call('is_class', scene.getNode('.'))).rejects.toThrow(
      'Camera3D::is_class: Cannot convert argument 1 from Object to String.'
    );
  });

  it('answers on the root window, a Window', async () => {
    const root = openScene({ source: SOURCE, provider }).getNodeOrNull('/root')!;
    expect(await root.call('is_class', 'Viewport')).toBe(true);
  });
});

describe('get_class', () => {
  it("answers the node's class", async () => {
    expect(await eye().call('get_class')).toBe('Camera3D');
  });

  it("throws Godot's error for an argument it does not take", async () => {
    await expect(eye().call('get_class', 'x')).rejects.toThrow(
      'Camera3D::get_class: Method expected 0 argument(s), but called with 1.'
    );
  });
});

// With no GODOT_single_root extension, the glTF importer roots a scene at a Node3D (gltf_document.cpp:6885).
describe('the root node of a .glb scene', () => {
  const glbRoot = () =>
    openScene({ source: '', provider, rootScenePath: 'res://ship.glb' }).getNode('/root').getChildren()[0]!;

  it('answers get_class Node3D', async () => {
    expect(await glbRoot().call('get_class')).toBe('Node3D');
  });

  it('answers is_class Node3D', async () => {
    expect(await glbRoot().call('is_class', 'Node3D')).toBe(true);
  });
});

// Godot 4.6.3 makes a placeholder Node of a class it cannot make, measured on this scene.
describe('a node of a class Godot does not have', () => {
  const unknown = () =>
    openScene({
      source: `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="X" type="SomeFutureNode" parent="."]
`,
      provider,
    }).getNode('X');

  it('answers get_class Node', async () => {
    expect(await unknown().call('get_class')).toBe('Node');
  });

  it.each([
    ['Node', true],
    ['Node3D', false],
  ])('answers is_class %s with %s', async (className, expected) => {
    expect(await unknown().call('is_class', className)).toBe(expected);
  });

  it('answers get_owner with the root', async () => {
    expect(((await unknown().call('get_owner')) as { name: string } | null)?.name).toBe('Main');
  });
});

describe('a property setter called with a node', () => {
  it('refuses it and names the node, as no setter takes an Object', async () => {
    const scene = openScene({ source: SOURCE, provider });
    await expect(scene.getNode('Eye').call('set_fov', scene.getNode('.'))).rejects.toThrow(
      'Camera3D::set_fov: expected a value for argument 1, got the node at /root/Main'
    );
  });
});
