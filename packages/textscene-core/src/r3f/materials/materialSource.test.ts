/**
 * Where a material property points, and when it points at nothing. `useMaterial.test.tsx` covers
 * what each reference loads to, and `resources/materials/material/kind.test.ts` what it decodes to.
 */
import { describe, expect, it } from 'vitest';
import { NO_RESOURCES } from '../SceneResourcesContext';
import { heldMaterial, nodeMaterial } from './materialSource';

describe('nodeMaterial', () => {
  it('names nothing for an absent property, so the slot keeps what the surface had', () => {
    expect(nodeMaterial(undefined, NO_RESOURCES)).toBeUndefined();
    expect(nodeMaterial('', NO_RESOURCES)).toBeUndefined();
  });

  it("holds the node's own property locally, in the tables of the file that wrote the node", () => {
    expect(nodeMaterial('SubResource("m")', NO_RESOURCES)).toEqual({
      ref: 'SubResource("m")',
      resources: NO_RESOURCES,
      isHeldLocally: true,
    });
  });
});

describe('heldMaterial', () => {
  it('names nothing for a surface with no material, so its slot draws the default', () => {
    expect(heldMaterial(null, NO_RESOURCES, true)).toBeUndefined();
  });

  it('is held as the mesh holds it', () => {
    expect(heldMaterial('res://a.tres', NO_RESOURCES, false)?.isHeldLocally).toBe(false);
  });
});
