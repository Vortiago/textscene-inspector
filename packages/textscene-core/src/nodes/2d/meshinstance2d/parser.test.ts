import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseMeshInstance2D } from './parser';

const HEADING = heading('MeshInstance2D', { name: 'M' });

describe('parseMeshInstance2D', () => {
  it('keeps the mesh and texture references', () => {
    const properties = parseMeshInstance2D(HEADING, {
      mesh: 'SubResource("QuadMesh_1")',
      texture: 'ExtResource("1_tex")',
    });

    expect(properties.mesh).toBe('SubResource("QuadMesh_1")');
    expect(properties.texture).toBe('ExtResource("1_tex")');
  });

  it('keeps no reference for an unset or null slot', () => {
    const properties = parseMeshInstance2D(HEADING, { texture: 'null' });

    expect(properties.mesh).toBeUndefined();
    expect(properties.texture).toBeUndefined();
  });

  it('keeps the Node2D properties', () => {
    expect(parseMeshInstance2D(HEADING, { position: 'Vector2(10, 20)' }).position).toEqual({ x: 10, y: 20 });
  });
});
