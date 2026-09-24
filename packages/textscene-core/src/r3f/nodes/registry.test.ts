/** Each node type's index.ts self-registers in nodeComponentRegistry through a side-effect import. */

import { describe, expect, it } from 'vitest';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import './index';

describe('R3F NodeComponentRegistry self-registration', () => {
  const mvsTypes = [
    'Node',
    'Node3D',
    'MeshInstance3D',
    'Camera3D',
    'DirectionalLight3D',
    'OmniLight3D',
    'SpotLight3D',
    'WorldEnvironment',
    'Label3D',
    'Sprite3D',
    'AudioStreamPlayer3D',
  ];

  it.each(mvsTypes)('registers a component for %s', (typeName) => {
    expect(nodeComponentRegistry.get(typeName)).toBeDefined();
  });

  it('exposes all MVS types via getAllTypeNames', () => {
    const all = nodeComponentRegistry.getAllTypeNames();
    for (const t of mvsTypes) {
      expect(all).toContain(t);
    }
  });

  it('returns undefined for unrecognised types so the dispatcher can fall back', () => {
    expect(nodeComponentRegistry.get('SomeRandomNodeType')).toBeUndefined();
  });

  it('silently overwrites duplicate registrations (HMR compatibility)', () => {
    const FirstFake = () => null;
    const SecondFake = () => null;
    nodeComponentRegistry.register({ typeName: '__HmrTest', Component: FirstFake });
    expect(nodeComponentRegistry.get('__HmrTest')).toBe(FirstFake);
    nodeComponentRegistry.register({ typeName: '__HmrTest', Component: SecondFake });
    expect(nodeComponentRegistry.get('__HmrTest')).toBe(SecondFake);
  });
});
