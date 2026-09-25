import { describe, it, expect } from 'vitest';
import { parseNode } from './parser';
import { heading } from '../../parser/testing/parserKit';

describe('parseNode', () => {
  it('parses basic Node with name', () => {
    const p = parseNode(heading('Node', { name: 'Root' }), {});
    expect(p.name).toBe('Root');
    expect(p.parent).toBeUndefined();
    expect(p.index).toBeUndefined();
    expect(p.transform).toBeUndefined();
  });

  it('parses Node with parent reference', () => {
    const p = parseNode(heading('Node', { name: 'Child', parent: '.' }), {});
    expect(p.name).toBe('Child');
    expect(p.parent).toBe('.');
  });

  it('parses Node with complex parent path', () => {
    const p = parseNode(heading('Node', { name: 'Leaf', parent: 'Root/Branch/Twig' }), {});
    expect(p.parent).toBe('Root/Branch/Twig');
  });

  it('parses index attribute', () => {
    const p = parseNode(heading('Node', { name: 'Child', index: '5' }), {});
    expect(p.index).toBe(5);
    expect(p.name).toBe('Child');
  });

  it('handles missing name (defaults to empty string)', () => {
    const p = parseNode(heading('Node', { name: '' }), {});
    expect(p.name).toBe('');
  });

  it('parses ExtResource instance reference', () => {
    const p = parseNode(
      heading('Node', { name: 'Enemy', instance: 'ExtResource("1_scene")' }),
      {}
    );
    expect(p.instance).toBe('ExtResource("1_scene")');
  });

  it('handles malformed instance gracefully (raw pass-through)', () => {
    const p = parseNode(heading('Node', { name: 'X', instance: 'garbage' }), {});
    expect(p.instance).toBe('garbage');
  });

  it('returns identity transform for malformed transform', () => {
    const p = parseNode(heading('Node', { name: 'N' }), { transform: 'not-a-transform' });
    // Full identity basis and zero origin: asserting the whole 3x3 (not only
    // basis_x.x) so this distinguishes true identity from a partially-wrong basis.
    expect(p.transform).toEqual({
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 0, y: 0, z: 0 },
    });
  });

  it('returns undefined transform when no transform property', () => {
    const p = parseNode(heading('Node', { name: 'N' }), {});
    expect(p.transform).toBeUndefined();
  });

  it('parses valid transform on base Node', () => {
    const p = parseNode(heading('Node', { name: 'N' }), {
      transform: 'Transform3D(1,0,0,0,1,0,0,0,1,5,10,15)',
    });
    expect(p.transform).toBeDefined();
    expect(p.transform!.origin.x).toBe(5);
    expect(p.transform!.origin.y).toBe(10);
    expect(p.transform!.origin.z).toBe(15);
  });
});
