/**
 * No two sources inline the same ArrayMesh surface bytes. A surface's `format` encodes its vertex
 * layout, so a copy that a decoder change leaves stale decodes into other geometry, and only the
 * suite that re-baked its own copy fails to say so. A shared surface lives in `arrayMeshSurfaces.ts`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoPath, walkSources } from '../../r3f/testing/sourceScan';
import { repoRoot } from '../../parser/testing/parserKit';
import { headlightsSurface, truncatedSurface, wallQuadSurface, wallQuadSurfaces } from './arrayMeshSurfaces';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SHARED_MODULE = 'packages/textscene-core/src/resources/testing/arrayMeshSurfaces.ts';
const SHARED_SURFACES = [wallQuadSurface(), headlightsSurface(), truncatedSurface()];

/**
 * A literal surface: one dictionary with a `format` and a `vertex_data`. A `${…}` inside it is
 * one more key, such as an optional `"material"`, so a copy that interpolates one is still caught.
 * A dictionary without `format` is variant-parser input, not a mesh layout.
 */
const SURFACE_BODY = String.raw`(?:[^{}$]|\$\{[^{}]*\})*`;
const SURFACE_RE = new RegExp(
  String.raw`\{${SURFACE_BODY}"format": \d+${SURFACE_BODY}"vertex_data": PackedByteArray\("[^"]*"\)${SURFACE_BODY}\}`,
  'g'
);
const BLOB_RE = /"(\w+)": PackedByteArray\("([^"]*)"\)/g;

/** A surface's bytes: every `PackedByteArray` entry, sorted by key. Material and name are not bytes. */
function surfaceBytes(surface: string): string {
  return [...surface.matchAll(BLOB_RE)]
    .map(([, key, base64]) => `${key}=${base64}`)
    .sort()
    .join(' ');
}

function bytesOfSurfacesIn(text: string): Set<string> {
  return new Set([...text.matchAll(SURFACE_RE)].map(([surface]) => surfaceBytes(surface)));
}

/** Each surface's bytes, mapped to every source that holds them. */
function holdersByBytes(): Map<string, string[]> {
  const sources = walkSources([SRC_ROOT], (name) => /\.tsx?$/.test(name)).map(({ file, source }) => ({
    path: repoPath(file),
    surfaces: bytesOfSurfacesIn(source),
  }));
  sources.push({ path: SHARED_MODULE, surfaces: bytesOfSurfacesIn(SHARED_SURFACES.join('\n')) });

  const holders = new Map<string, string[]>();
  for (const { path, surfaces } of sources) {
    for (const bytes of surfaces) holders.set(bytes, [...(holders.get(bytes) ?? []), path]);
  }
  return holders;
}

describe('ArrayMesh surface bytes have one source', () => {
  it('reads every shared surface as a surface, so the sweep cannot pass vacuously', () => {
    expect(bytesOfSurfacesIn(SHARED_SURFACES.join('\n')).size).toBe(SHARED_SURFACES.length);
  });

  it('reads a copy that interpolates a key as a surface', () => {
    const copy = wallQuadSurface({ name: 'n' }).replace('"name"', '${materialKey}"name"');

    expect(bytesOfSurfacesIn(copy)).toEqual(new Set([surfaceBytes(wallQuadSurface())]));
  });

  it('keys a surface by its bytes alone, so material and name do not hide a copy', () => {
    expect(surfaceBytes(wallQuadSurface({ material: 'SubResource("M")', name: 'n' }))).toBe(
      surfaceBytes(wallQuadSurface())
    );
  });

  it('holds each surface in one source', () => {
    const duplicated = [...holdersByBytes().values()].filter((paths) => paths.length > 1);

    expect(duplicated).toEqual([]);
  });
});

describe('the shared surfaces match the Godot files they come from', () => {
  const read = (path: string) => readFileSync(resolve(repoRoot(), path), 'utf8');

  it('matches the surface wall.tres writes', () => {
    const surface = wallQuadSurface({ material: 'ExtResource("1_a5mma")', name: 'tile_material' });

    expect(read('scenes/demos/3d/platformer/stage/meshes/wall.tres')).toContain(surface);
  });

  it('matches the headlights surface truck_cab.tres writes', () => {
    const surface = headlightsSurface({
      material: 'SubResource("StandardMaterial3D_7b7ut")',
      name: 'headlights',
    });

    expect(read('scenes/demos/3d/truck_town/vehicles/meshes/truck_cab.tres')).toContain(surface);
  });
});

describe('a surface writer', () => {
  it('writes the bare surface with no material and no name', () => {
    const surface = wallQuadSurface({ material: null, name: null });

    expect(surface).not.toContain('"material"');
    expect(surface).not.toContain('"name"');
  });

  it('writes material and name between index_data and primitive, in the order Godot uses', () => {
    const surface = wallQuadSurface({ material: 'ExtResource("1_a")', name: 'tile' });

    expect(surface).toContain(
      '"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),\n"material": ExtResource("1_a"),\n"name": "tile",\n"primitive": 3,'
    );
  });

  it('opens and closes the surface as one dictionary', () => {
    const surface = truncatedSurface({ name: 'truncated' });

    expect(surface.startsWith('{\n"aabb"')).toBe(true);
    expect(surface.endsWith('"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/")\n}')).toBe(
      true
    );
  });
});

describe('wallQuadSurfaces', () => {
  it('joins one surface per entry into a _surfaces array, in order', () => {
    expect(wallQuadSurfaces({ name: 'a' }, { name: 'b' })).toBe(
      `[${wallQuadSurface({ name: 'a' })}, ${wallQuadSurface({ name: 'b' })}]`
    );
  });
});
