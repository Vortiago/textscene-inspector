import { describe, it, expect } from 'vitest';
import { parseNode } from './parser';
import type { ParsedHeading } from '../../parser/utils';

// Helper: build a minimal ParsedHeading for Node with the given attributes.
function nodeHeading(attrs: Record<string, string> = {}): ParsedHeading {
  return {
    type: 'node',
    attributes: { type: 'Node', name: '', ...attrs },
  };
}

describe('parseNode', () => {
  it('parses basic Node with name', () => {
    const heading = nodeHeading({ name: 'Root' });
    const p = parseNode(heading, {});
    expect(p.name).toBe('Root');
    expect(p.parent).toBeUndefined();
    expect(p.index).toBeUndefined();
    expect(p.transform).toBeUndefined();
  });

  it('parses Node with parent reference', () => {
    const heading = nodeHeading({ name: 'Child', parent: '.' });
    const p = parseNode(heading, {});
    expect(p.name).toBe('Child');
    expect(p.parent).toBe('.');
  });

  it('parses Node with complex parent path', () => {
    const heading = nodeHeading({ name: 'Leaf', parent: 'Root/Branch/Twig' });
    const p = parseNode(heading, {});
    expect(p.parent).toBe('Root/Branch/Twig');
  });

  it('parses index attribute', () => {
    const heading = nodeHeading({ name: 'Child', index: '5' });
    const p = parseNode(heading, {});
    expect(p.index).toBe(5);
    expect(p.name).toBe('Child');
  });

  it('handles missing name (defaults to empty string)', () => {
    const heading = nodeHeading({});
    const p = parseNode(heading, {});
    expect(p.name).toBe('');
  });

  it('parses ExtResource instance reference', () => {
    const heading = nodeHeading({ name: 'Enemy', instance: 'ExtResource("1_scene")' });
    const p = parseNode(heading, {});
    expect(p.instance).toBe('ExtResource("1_scene")');
  });

  it('handles malformed instance gracefully (raw pass-through)', () => {
    const heading = nodeHeading({ name: 'X', instance: 'garbage' });
    const p = parseNode(heading, {});
    expect(p.instance).toBe('garbage');
  });

  it('returns identity transform for malformed transform', () => {
    const heading = nodeHeading({ name: 'N' });
    const p = parseNode(heading, { transform: 'not-a-transform' });
    // Full identity basis + zero origin — asserting the whole 3x3 (not just
    // basis_x.x) so this distinguishes true identity from a partially-wrong basis.
    expect(p.transform).toEqual({
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 0, y: 0, z: 0 },
    });
  });

  it('returns undefined transform when no transform property', () => {
    const heading = nodeHeading({ name: 'N' });
    const p = parseNode(heading, {});
    expect(p.transform).toBeUndefined();
  });

  it('parses valid transform on base Node', () => {
    const heading = nodeHeading({ name: 'N' });
    const p = parseNode(heading, { transform: 'Transform3D(1,0,0,0,1,0,0,0,1,5,10,15)' });
    expect(p.transform).toBeDefined();
    expect(p.transform!.origin.x).toBe(5);
    expect(p.transform!.origin.y).toBe(10);
    expect(p.transform!.origin.z).toBe(15);
  });
});
