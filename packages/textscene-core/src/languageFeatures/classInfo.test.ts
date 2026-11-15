import { describe, expect, it } from 'vitest';
import { isKnownClass, nodeClassNames, resourceClassNames } from './classInfo';

describe('classInfo', () => {
  it('knows a node class, a resource class and neither for an invented name', () => {
    expect(isKnownClass('MeshInstance3D')).toBe(true);
    expect(isKnownClass('BoxMesh')).toBe(true);
    expect(isKnownClass('NotAClass')).toBe(false);
  });

  it('offers every node and resource class a scene may name', () => {
    expect(nodeClassNames()).toContain('MeshInstance3D');
    expect(nodeClassNames()).toContain('Node');
    expect(resourceClassNames()).toContain('BoxMesh');
    expect(resourceClassNames()).toContain('Resource');
  });
});
