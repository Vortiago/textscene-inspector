/**
 * NodeRegistry resolves a heading to its registration by the heading's
 * `type` attribute. The match is a direct typeName lookup — slices no
 * longer author a per-type guard — but it stays scoped to `[node]`
 * headings so a `[sub_resource]` whose `type=` collides with a node name
 * can never resolve to a node registration.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { nodeRegistry } from './NodeRegistry';
import type { ParsedHeading } from '../parser/utils';

function nodeHeading(type: string): ParsedHeading {
  return { type: 'node', attributes: { type, name: 'X' } };
}

describe('NodeRegistry.findRegistration', () => {
  beforeEach(() => nodeRegistry.clear());

  it('resolves a registration that declares NO typeGuard, by its typeName', () => {
    nodeRegistry.register({
      typeName: 'Widget3D',
      parser: (_h, props) => ({ name: props.name ?? 'X' }),
    });

    const reg = nodeRegistry.findRegistration(nodeHeading('Widget3D'));

    expect(reg?.typeName).toBe('Widget3D');
  });

  it('returns null for a node type that is not registered', () => {
    nodeRegistry.register({ typeName: 'Widget3D', parser: () => ({}) });

    expect(nodeRegistry.findRegistration(nodeHeading('Unknown'))).toBeNull();
  });

  it('does NOT match a [sub_resource] heading whose type collides with a node typeName', () => {
    nodeRegistry.register({ typeName: 'BoxMesh', parser: () => ({}) });

    const subResource: ParsedHeading = {
      type: 'sub_resource',
      attributes: { type: 'BoxMesh', id: '1' },
    };

    expect(nodeRegistry.findRegistration(subResource)).toBeNull();
  });

  it('returns null for a node heading with no type attribute', () => {
    nodeRegistry.register({ typeName: 'Widget3D', parser: () => ({}) });

    expect(nodeRegistry.findRegistration({ type: 'node', attributes: {} })).toBeNull();
  });

  it('ignores a legacy typeGuard and still resolves by typeName (back-compat)', () => {
    nodeRegistry.register({
      typeName: 'Legacy3D',
      // A guard that would REJECT this heading — proving the guard is ignored
      // and the typeName Map lookup is authoritative.
      typeGuard: () => false,
      parser: () => ({}),
    });

    expect(nodeRegistry.findRegistration(nodeHeading('Legacy3D'))?.typeName).toBe('Legacy3D');
  });
});
