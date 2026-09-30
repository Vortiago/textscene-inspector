/**
 * A StandardMaterial3D built as the `.tres` pipeline builds it, from raw Godot property
 * strings. Build-excluded through the `src/**\/testing/**` tsconfig rule (test-only).
 */

import type * as THREE from 'three';
import { buildStandardMaterial } from '../build';
import { parseStandardMaterial3DScalars } from '../scalars';

export function standardMaterial(properties: Record<string, string> = {}): THREE.Material {
  return buildStandardMaterial(parseStandardMaterial3DScalars(properties));
}
