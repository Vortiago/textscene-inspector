import { describe, expect, it } from 'vitest';
import { layerRawOverride } from './layerRawOverride';
import { parsedNode, translated } from '../parser/testing/parserKit';
import type { Camera3DProperties } from '../nodes/3d/camera3d/types';
import type { NodeProperties } from '../nodes/node/types';
import '../nodes/node/index';
import '../nodes/3d/camera3d/index';

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

  it('canonicalises a pre-4.0 alias in the override so it wins over the canonical base key', () => {
    // The override comes from an `instance=` heading with no `type=`, so the scanner kept the alias.
    const base = parsedNode({ name: 'Mesh', type: 'MeshInstance3D' }, { gi_mode: '2' });

    const layered = layerRawOverride(base, base, { use_in_baked_light: 'true' });

    expect(layered.rawProperties).toEqual({ gi_mode: '1' });
  });
});
