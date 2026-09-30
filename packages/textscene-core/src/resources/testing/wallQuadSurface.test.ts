/**
 * `wallQuadSurface.ts` is the only source that holds the wall quad's bytes. Its `format` encodes the
 * vertex layout, so a copy that a decoder change leaves stale decodes into other geometry, and only
 * the suite that re-baked its own copy fails to say so.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoPath, walkSources } from '../../r3f/testing/sourceScan';
import { repoRoot } from '../../parser/testing/parserKit';
import {
  WALL_QUAD_ATTRIBUTE_DATA,
  WALL_QUAD_VERTEX_DATA,
  wallQuadSurface,
  wallQuadSurfaces,
} from './wallQuadSurface';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHARED_MODULE = 'packages/textscene-core/src/resources/testing/wallQuadSurface.ts';
const WALL_TRES = resolve(repoRoot(), 'scenes/demos/3d/platformer/stage/meshes/wall.tres');

describe('the wall quad has one source', () => {
  const sources = walkSources([SRC_ROOT], (name) => /\.tsx?$/.test(name));

  it('finds the shared module in the sweep, so the sweep cannot pass vacuously', () => {
    expect(sources.map(({ file }) => repoPath(file))).toContain(SHARED_MODULE);
  });

  // Both blobs: the decode suite's other-UV variants share the `vertex_data` and are other meshes.
  it('holds the quad bytes in the shared module and in no other source', () => {
    const holders = sources.filter(
      ({ source }) => source.includes(WALL_QUAD_ATTRIBUTE_DATA) && source.includes(WALL_QUAD_VERTEX_DATA)
    );

    expect(holders.map(({ file }) => repoPath(file))).toEqual([SHARED_MODULE]);
  });

  it('matches the surface wall.tres itself writes', () => {
    const surface = wallQuadSurface({ material: 'ExtResource("1_a5mma")', name: 'tile_material' });

    expect(readFileSync(WALL_TRES, 'utf8')).toContain(surface);
  });
});

describe('wallQuadSurface', () => {
  it('writes the bare surface with no material and no name', () => {
    const surface = wallQuadSurface({ material: null, name: null });

    expect(surface).not.toContain('"material"');
    expect(surface).not.toContain('"name"');
  });

  it('writes material and name between index_data and primitive, in the order wall.tres uses', () => {
    const surface = wallQuadSurface({ material: 'ExtResource("1_a")', name: 'tile' });

    expect(surface).toContain(
      '"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),\n"material": ExtResource("1_a"),\n"name": "tile",\n"primitive": 3,'
    );
  });

  it('opens and closes the surface as one dictionary', () => {
    const surface = wallQuadSurface({ name: 'tile' });

    expect(surface.startsWith('{\n"aabb"')).toBe(true);
    expect(surface.endsWith(`"vertex_data": PackedByteArray("${WALL_QUAD_VERTEX_DATA}")\n}`)).toBe(true);
  });
});

describe('wallQuadSurfaces', () => {
  it('joins one surface per entry into a _surfaces array, in order', () => {
    expect(wallQuadSurfaces({ name: 'a' }, { name: 'b' })).toBe(
      `[${wallQuadSurface({ name: 'a' })}, ${wallQuadSurface({ name: 'b' })}]`
    );
  });
});
