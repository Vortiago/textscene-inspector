import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseMultiMeshInstance2D } from './parser';

const HEADING = heading('MultiMeshInstance2D', { name: 'M' });

describe('parseMultiMeshInstance2D', () => {
  it('keeps the multimesh and texture references', () => {
    const properties = parseMultiMeshInstance2D(HEADING, {
      multimesh: 'SubResource("MultiMesh_1")',
      texture: 'ExtResource("1_tex")',
    });

    expect(properties.multimesh).toBe('SubResource("MultiMesh_1")');
    expect(properties.texture).toBe('ExtResource("1_tex")');
  });

  it('keeps no reference for an unset or null slot', () => {
    const properties = parseMultiMeshInstance2D(HEADING, { texture: 'null' });

    expect(properties.multimesh).toBeUndefined();
    expect(properties.texture).toBeUndefined();
  });

  it('keeps the Node2D properties', () => {
    expect(parseMultiMeshInstance2D(HEADING, { position: 'Vector2(10, 20)' }).position).toEqual({
      x: 10,
      y: 20,
    });
  });
});
