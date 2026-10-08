import { describe, expect, it } from 'vitest';
import { resolveExtArrayMeshPath } from './meshResolution';

const EXTERNALS = [
  { id: '1', type: 'ArrayMesh', path: 'res://rock.tres' },
  { id: '2', type: 'PackedScene', path: 'res://rock.glb' },
  { id: '3', type: 'ArrayMesh', path: 'res:///meshes//rock.tres' },
];

describe('resolveExtArrayMeshPath', () => {
  it('resolves an ExtResource to its .tres path', () => {
    expect(resolveExtArrayMeshPath('ExtResource("1")', EXTERNALS)).toBe('res://rock.tres');
  });

  it('is null for a SubResource, a .glb or an unknown id', () => {
    expect(resolveExtArrayMeshPath('SubResource("1")', EXTERNALS)).toBeNull();
    expect(resolveExtArrayMeshPath('ExtResource("2")', EXTERNALS)).toBeNull();
    expect(resolveExtArrayMeshPath('ExtResource("9")', EXTERNALS)).toBeNull();
  });

  it('simplifies the path, so it shares one cache key with every other request for the file', () => {
    expect(resolveExtArrayMeshPath('ExtResource("3")', EXTERNALS)).toBe('res://meshes/rock.tres');
  });
});
