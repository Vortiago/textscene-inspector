/**
 * Decodes an ArrayMesh `.tres` fixture's `[resource]` body, for a suite that starts from
 * text. Test-only, like the rest of `testing/`, and it never imports `vitest`.
 */
import { parseTresFile } from '../../parser/parsedResource';
import { decodeArrayMesh } from '../meshes/arraymesh/decode';
import type { ArrayMeshData } from '../meshes/arraymesh/types';

export function decodeArrayMeshTres(tres: string, selfPath: string): ArrayMeshData {
  const file = parseTresFile(tres);
  return decodeArrayMesh(file.properties, file, selfPath);
}
