import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene } from './openScene';
import { variant } from './variant';
import type { ResourceProvider } from '../resources/ResourceProvider';

const provider: ResourceProvider = { loadResource: async () => null };

const SOURCE = `[gd_scene format=3]

[node name="Main" type="Node2D"]

[node name="View" type="Camera2D" parent="."]

[node name="Eye" type="Camera3D" parent="."]

[node name="Second" type="Camera3D" parent="."]
`;

const scene = () => openScene({ source: SOURCE, provider });

describe('call', () => {
  it('reaches set through a setter ClassDB names set_<property>', async () => {
    const opened = scene();
    await opened.getNode('View').call('set_zoom', variant('Vector2(2, 3)'));
    expect(await opened.getNode('View').get('zoom')).toEqual(variant('Vector2(2, 3)'));
  });

  it('reaches get through a getter of another name', async () => {
    expect(await scene().getNode('View').call('is_enabled')).toBe(true);
  });

  it('passes the index of an indexed setter as its first argument', async () => {
    const opened = scene();
    await opened.getNode('View').call('set_limit', 2, 640);
    expect(await opened.getNode('View').get('limit_right')).toBe(640);
  });

  it('casts an index the host passes as a Variant to an int', async () => {
    const opened = scene();
    await opened.getNode('View').call('set_limit', variant('2.0'), 640);
    expect(await opened.getNode('View').get('limit_right')).toBe(640);
  });

  it("throws Godot's error for an index the binding cannot convert", async () => {
    await expect(scene().getNode('View').call('get_limit', 'right')).rejects.toThrow(
      'Camera2D::get_limit: Cannot convert argument 1 from String to int.'
    );
  });

  it('passes the index of an indexed getter as its only argument', async () => {
    expect(await scene().getNode('View').call('get_limit', 0)).toBe(-10000000);
  });

  it('reaches a setter whose name differs from its property', async () => {
    const opened = scene();
    await opened.getNode('Eye').call('set_keep_aspect_mode', 0);
    expect(await opened.getNode('Eye').get('keep_aspect')).toBe(0);
  });

  it('throws for a camera method it does not port, naming the class and the method', async () => {
    await expect(scene().getNode('Eye').call('project_ray_normal', variant('Vector2(0, 0)'))).rejects.toThrow(
      'Camera3D::project_ray_normal: not a method this release ports'
    );
  });

  it('throws for a method of a class with no ported method, naming the class and the method', async () => {
    await expect(scene().getNode('.').call('look_at', variant('Vector2(0, 0)'))).rejects.toThrow(
      'Node2D::look_at: not a method this release ports'
    );
  });

  it("throws Godot's error for an argument the binding cannot convert", async () => {
    await expect(scene().getNode('Eye').call('clear_current', 'yes')).rejects.toThrow(
      'Camera3D::clear_current: Cannot convert argument 1 from String to bool.'
    );
  });

  it('converts a float argument to bool, as the binding does', async () => {
    const opened = scene();
    await opened.getNode('Eye').call('clear_current', 0.5);
    expect(await opened.getNode('Second').call('is_current')).toBe(true);
  });

  it('checks the count of an indexed call before its index (edge case)', async () => {
    await expect(scene().getNode('View').call('set_limit')).rejects.toThrow(
      'Camera2D::set_limit: Method expected 2 argument(s), but called with 0.'
    );
  });

  it('throws for a node a new text freed while the call waited', async () => {
    const opened = scene();
    const call = opened.getNode('View').call('set_zoom', variant('Vector2(2, 3)'));
    opened.setSource(`${SOURCE}\n[node name="Other" type="Node2D" parent="."]\n`);
    await expect(call).rejects.toThrow('freed by a new text');
  });

  it('throws for a count of arguments the binding does not take', async () => {
    await expect(scene().getNode('Eye').call('make_current', true)).rejects.toThrow(
      'Camera3D::make_current: Method expected 0 argument(s), but called with 1.'
    );
  });
});

describe('set through a ported setter', () => {
  it('reports a value with no strict cast as an invalid write (class_db.cpp:1683)', async () => {
    expect(await scene().getNode('Second').set('current', 'yes')).toBe(false);
  });

  it('still runs the setter with the value booleanised, as Godot does', async () => {
    const opened = scene();
    await opened.getNode('Second').set('current', 'yes');
    expect(await opened.getNode('Second').get('current')).toBe(true);
  });

  it('booleanises a zero vector to false', async () => {
    const opened = scene();
    await opened.getNode('Eye').set('current', variant('Vector3(0, 0, 0)'));
    expect(await opened.getNode('Second').get('current')).toBe(true);
  });

  it('runs the setter for a value it can cast', async () => {
    const opened = scene();
    expect(await opened.getNode('Eye').set('current', true)).toBe(true);
    expect(await opened.getNode('Eye').get('current')).toBe(true);
  });
});
