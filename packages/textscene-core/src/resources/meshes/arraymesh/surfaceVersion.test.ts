/**
 * The upgrade of a surface Godot saved before format version 2. `testing/cubeUpgraded.tres` is
 * Godot 4.6.3's save of the version 1 `cube.mesh` from the kinematic_character demo: Godot's own
 * upgrade, the answer the decode must reach.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { scenesDir } from '../../../parser/testing/parserKit';
import { parseBinaryResource } from '../../formats/binaryresource/parse';
import { fileBytes } from '../../testing/fileBytes';
import { decodeArrayMeshTres } from '../../testing/decodeArrayMeshTres';
import { decodeArrayMesh } from './decode';
import type { ArrayMeshData } from './types';

const VERSION_1_CUBE = resolve(scenesDir(), 'demos/3d/kinematic_character/models/cube.mesh');

async function decodeVersion1Cube(): Promise<ArrayMeshData> {
  const file = await parseBinaryResource(fileBytes(VERSION_1_CUBE));
  return decodeArrayMesh(
    { file, type: file.resourceType, properties: file.properties },
    'res://models/cube.mesh'
  );
}

function decodeGodotUpgrade(): ArrayMeshData {
  const text = readFileSync(join(import.meta.dirname, 'testing', 'cubeUpgraded.tres'), 'utf8');
  return decodeArrayMeshTres(text, 'res://models/cube.tres');
}

/** A one-triangle surface with `format`, its three positions at the origin. */
function triangleTres(format: string): string {
  return `[gd_resource type="ArrayMesh" format=4]

[resource]
_surfaces = [{
"aabb": AABB(0, 0, 0, 0, 0, 0),
"format": ${format},
"primitive": 3,
"vertex_count": 3,
"vertex_data": PackedByteArray("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
}]
`;
}

describe('a version 1 surface', () => {
  it('decodes to the positions of the surface Godot upgrades it to', async () => {
    const [ours] = (await decodeVersion1Cube()).surfaces;
    expect(Array.from(ours!.positions)).toEqual(Array.from(decodeGodotUpgrade().surfaces[0]!.positions));
  });

  it('decodes to the normals and tangents of the surface Godot upgrades it to', async () => {
    const [ours] = (await decodeVersion1Cube()).surfaces;
    const [godot] = decodeGodotUpgrade().surfaces;
    expect(Array.from(ours!.normals!)).toEqual(Array.from(godot!.normals!));
    expect(Array.from(ours!.tangents!)).toEqual(Array.from(godot!.tangents!));
  });

  it('keeps the vertex record of a surface with positions alone, which has nothing to move (edge case)', () => {
    expect(Array.from(decodeArrayMeshTres(triangleTres('1'), 'res://t.tres').surfaces[0]!.positions)).toEqual(
      new Array(9).fill(0)
    );
  });
});

describe('a surface from a newer format', () => {
  it('fails the mesh, as Godot refuses to load a format version above its own', () => {
    expect(() => decodeArrayMeshTres(triangleTres('103079215105'), 'res://t.tres')).toThrow(
      'expected a surface format version field up to 1, got 3'
    );
  });
});
