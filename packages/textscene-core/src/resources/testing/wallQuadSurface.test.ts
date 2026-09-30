/**
 * `wallQuadSurface.ts` is the only source that holds the wall quad's bytes. Its `format` encodes the
 * vertex layout, so a copy that a decoder change leaves stale decodes into other geometry, and only
 * the suite that re-baked its own copy fails to say so.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wallQuadSurface } from './wallQuadSurface';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/resources/testing
const srcRoot = resolve(here, '../..');
const SHARED_MODULE = 'resources/testing/wallQuadSurface.ts';

/** Every `.ts` and `.tsx` file under `src/`, as a path relative to it. */
function sourceFiles(dir: string = srcRoot): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry.name)) found.push(relative(srcRoot, path));
  }
  return found.sort();
}

/**
 * The base64 of the quad's `attribute_data` and `vertex_data`. A file holds the quad only when it
 * holds both: the decode suite's other-UV variants share its `vertex_data` and are other meshes.
 */
function quadBlobs(): string[] {
  const surface = wallQuadSurface();
  return ['attribute_data', 'vertex_data'].map((key) => {
    const match = new RegExp(`"${key}": PackedByteArray\\("([^"]+)"\\)`).exec(surface);
    if (!match) throw new Error(`expected a ${key} entry, got ${surface}`);
    return match[1]!;
  });
}

function holdsQuad(file: string): boolean {
  const source = readFileSync(resolve(srcRoot, file), 'utf8');
  return quadBlobs().every((blob) => source.includes(blob));
}

describe('the wall quad has one source', () => {
  it('finds the shared module in the sweep, so the sweep cannot pass vacuously', () => {
    expect(sourceFiles()).toContain(SHARED_MODULE);
  });

  it('holds the quad bytes in the shared module and in no other source', () => {
    expect(sourceFiles().filter(holdsQuad)).toEqual([SHARED_MODULE]);
  });
});

describe('wallQuadSurface', () => {
  it('writes the bare surface with no material and no name', () => {
    const surface = wallQuadSurface();

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
    const [, vertexData] = quadBlobs();

    expect(surface.startsWith('{\n"aabb"')).toBe(true);
    expect(surface.endsWith(`"vertex_data": PackedByteArray("${vertexData}")\n}`)).toBe(true);
  });
});
