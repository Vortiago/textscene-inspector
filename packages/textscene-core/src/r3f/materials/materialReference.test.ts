/**
 * Where a material property points, and when it points at nothing. `useMaterial.test.tsx` covers
 * what each reference loads to, and `resources/materials/material/kind.test.ts` what it decodes to.
 */
import { describe, expect, it } from 'vitest';
import { NO_RESOURCES, type SceneResources } from '../SceneResourcesContext';
import { heldMaterial, nodeMaterial } from './materialReference';

const TABLES: SceneResources = {
  internalResources: [
    { id: 'm', type: 'StandardMaterial3D', data: {} },
    { id: 'box', type: 'BoxMesh', data: {} },
  ],
  externalResources: [{ id: 'img', path: 'res://icon.png', type: 'Texture2D' }],
};

describe('nodeMaterial', () => {
  it('names nothing for an absent property, so the slot keeps what the surface had', () => {
    expect(nodeMaterial(undefined, NO_RESOURCES)).toBeUndefined();
    expect(nodeMaterial('', NO_RESOURCES)).toBeUndefined();
  });

  it("names nothing for an outer scene's null, so the surface keeps its own material", () => {
    expect(nodeMaterial('null', NO_RESOURCES)).toBeUndefined();
  });

  it("holds the node's own property locally, in the tables of the file that wrote the node", () => {
    expect(nodeMaterial('SubResource("m")', TABLES)).toEqual({
      ref: 'SubResource("m")',
      resources: TABLES,
      isHeldLocally: true,
    });
  });

  it('names nothing for an id the tables do not declare, so an override keeps the surface material', () => {
    expect(nodeMaterial('SubResource("deleted")', TABLES)).toBeUndefined();
    expect(nodeMaterial('ExtResource("deleted")', TABLES)).toBeUndefined();
  });

  it('names nothing for a resource that is not a material, as Godot refuses the property', () => {
    expect(nodeMaterial('SubResource("box")', TABLES)).toBeUndefined();
    expect(nodeMaterial('ExtResource("img")', TABLES)).toBeUndefined();
  });

  it('names a resource file that has not loaded yet, which may hold a material', () => {
    expect(nodeMaterial('res://later.tres', NO_RESOURCES)?.ref).toBe('res://later.tres');
  });
});

describe('heldMaterial', () => {
  it('names nothing for a surface with no material, so its slot draws the default', () => {
    expect(heldMaterial(null, NO_RESOURCES, true)).toBeUndefined();
  });

  it('names nothing for a surface whose material is the null literal', () => {
    expect(heldMaterial('null', NO_RESOURCES, true)).toBeUndefined();
  });

  it('names nothing for a mesh slot whose id the file does not declare', () => {
    expect(heldMaterial('SubResource("deleted")', TABLES, true)).toBeUndefined();
  });

  it('is held as the mesh holds it', () => {
    expect(heldMaterial('res://a.tres', NO_RESOURCES, false)?.isHeldLocally).toBe(false);
  });
});
