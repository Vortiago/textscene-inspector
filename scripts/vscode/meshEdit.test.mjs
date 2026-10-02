import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { withSurfaceAlbedo } from './meshEdit.mjs';
const QUAD = readFileSync(path.join(REPO_ROOT, 'scenes/fixtures/unit-arraymesh-quad.tres'), 'utf8');
const RED = 'Color(1, 0, 0, 1)';

describe('withSurfaceAlbedo', () => {
  it('declares the material before the resource section', () => {
    const edited = withSurfaceAlbedo(QUAD, RED);

    expect(edited).toMatch(
      /\[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_hotreload"\]\nalbedo_color = Color\(1, 0, 0, 1\)\n\n\[resource\]/
    );
  });

  it('points the surface at it, after its index data as Godot writes the keys', () => {
    const edited = withSurfaceAlbedo(QUAD, RED);

    expect(edited).toMatch(
      /"index_data": [^\n]*,\n"material": SubResource\("StandardMaterial3D_hotreload"\),\n"primitive"/
    );
  });

  it('keeps the geometry byte for byte, so the bounds do not move', () => {
    const vertexData = (tres) => tres.match(/"vertex_data": [^\n]*/)[0];
    const aabb = (tres) => tres.match(/"aabb": [^\n]*/)[0];
    const edited = withSurfaceAlbedo(QUAD, RED);

    expect(vertexData(edited)).toBe(vertexData(QUAD));
    expect(aabb(edited)).toBe(aabb(QUAD));
  });

  it('refuses a mesh that already names a material', () => {
    expect(() => withSurfaceAlbedo(withSurfaceAlbedo(QUAD, RED), RED)).toThrow(/carry no material/);
  });

  it('refuses text with no surface to edit', () => {
    expect(() => withSurfaceAlbedo('[gd_resource type="ArrayMesh" format=4]\n\n[resource]\n', RED)).toThrow(
      /found none/
    );
  });
});
