import { describe, expect, it } from 'vitest';
import { layerRawOverride } from './layerRawOverride';
import { parsedNode, translated } from '../parser/testing/parserKit';
import type { Camera3DProperties } from '../nodes/3d/camera3d/types';
import type { NodeProperties } from '../nodes/node/types';
import type { WindowProperties } from '../nodes/windows/window/types';
import '../nodes/node/index';
import '../nodes/3d/camera3d/index';
import '../nodes/windows/window/index';

describe('layerRawOverride', () => {
  it("parses the override with the base type's parser and keeps a base-only value", () => {
    const base = parsedNode({ name: 'Cam', type: 'Camera3D' }, { fov: '70.0', current: 'true' });

    const layered = layerRawOverride(base, base, { fov: '42.5' });

    const properties = layered.properties as Camera3DProperties;
    expect(properties.fov).toBe(42.5);
    expect(properties.current).toBe(true);
  });

  it('parses an unregistered type as a Node, so its typed properties take the override', () => {
    const base = parsedNode(
      { name: 'Coin', type: 'UnregisteredCustomType3D' },
      { transform: translated(1, 0, 0) }
    );

    const layered = layerRawOverride(base, base, { transform: translated(5, 0, 0) });

    expect((layered.properties as NodeProperties).transform?.origin).toEqual({ x: 5, y: 0, z: 0 });
  });

  it("keeps the seat's heading index and instance ref", () => {
    const seat = parsedNode({ name: 'Coin', type: 'Node3D', index: '2', instance: 'ExtResource("1")' });

    const layered = layerRawOverride(seat, seat, { visible: 'false' });

    expect(layered.properties).toMatchObject({ index: 2, instance: 'ExtResource("1")' });
  });

  it('marks the layered key order as no single file order', () => {
    const base = parsedNode({ name: 'Cam', type: 'Camera3D' }, { fov: '70.0' });

    expect(layerRawOverride(base, base, { current: 'true' }).rawPropertiesOrderReliable).toBe(false);
  });

  it("keeps the base's key order when the override writes no keys", () => {
    const base = parsedNode({ name: 'Cam', type: 'Camera3D' }, { fov: '70.0' });

    expect(layerRawOverride(base, base, {}).rawPropertiesOrderReliable).toBe(true);
  });

  it('canonicalises a pre-4.0 alias in the override so it wins over the canonical base key', () => {
    // The override comes from an `instance=` heading with no `type=`, so the scanner kept the alias.
    const base = parsedNode({ name: 'Mesh', type: 'MeshInstance3D' }, { gi_mode: '2' });

    const layered = layerRawOverride(base, base, { use_in_baked_light: 'true' });

    expect(layered.rawProperties).toEqual({ gi_mode: '1' });
  });

  /** An override runs its setters after the base's, so `set_force_native` meets the base's `visible` (`window.cpp:1380-1386`). */
  describe('an override of a Window, whose force_native setter reads visible', () => {
    const forceNativeOf = (baseRaw: Record<string, string>, overrideRaw: Record<string, string>) => {
      const base = parsedNode({ name: 'Dialog', type: 'Window' }, baseRaw);
      return (layerRawOverride(base, base, overrideRaw).properties as WindowProperties).force_native;
    };

    it('keeps the force_native a hidden base took when the override shows the window', () => {
      expect(forceNativeOf({ visible: 'false', force_native: 'true' }, { visible: 'true' })).toBe(true);
    });

    it('takes an override force_native on a base that hides the window after its refused line', () => {
      expect(forceNativeOf({ force_native: 'true', visible: 'false' }, { force_native: 'true' })).toBe(true);
    });

    it('refuses an override force_native on a base that is visible', () => {
      expect(forceNativeOf({}, { force_native: 'true' })).toBe(false);
    });

    it('takes an override force_native written below its own visible = false', () => {
      expect(forceNativeOf({}, { visible: 'false', force_native: 'true' })).toBe(true);
    });
  });

  /** Measured with `pnpm ref:diff` on Godot 4.6.3: the override's setters run over the size and background the base left. */
  describe('an override of a Window whose setters read what the base left', () => {
    const windowOf = (baseRaw: Record<string, string>, overrideRaw: Record<string, string>) => {
      const base = parsedNode({ name: 'Win', type: 'Window' }, baseRaw);
      return layerRawOverride(base, base, overrideRaw).properties as WindowProperties;
    };

    it('keeps the size a base cap took when the override lifts the cap', () => {
      const base = { size: 'Vector2i(500, 350)', max_size: 'Vector2i(300, 200)' };
      expect(windowOf(base, { max_size: 'Vector2i(0, 0)' }).size).toEqual({ x: 300, y: 200 });
    });

    it('takes an override size under the cap the base set', () => {
      const base = { max_size: 'Vector2i(300, 200)' };
      expect(windowOf(base, { size: 'Vector2i(500, 350)' }).size).toEqual({ x: 300, y: 200 });
    });

    it('takes an override transparent_bg over a base whose transparent line came last', () => {
      const base = { transparent_bg: 'true', transparent: 'false' };
      expect(windowOf(base, { transparent_bg: 'true' }).transparent_bg).toBe(true);
    });

    it('keeps the background the base left when the override writes neither key', () => {
      const base = { transparent_bg: 'true', transparent: 'false' };
      expect(windowOf(base, { title: '"Other"' }).transparent_bg).toBe(false);
    });
  });
});
