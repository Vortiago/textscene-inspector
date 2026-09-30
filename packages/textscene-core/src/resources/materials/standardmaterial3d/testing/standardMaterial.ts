/**
 * A StandardMaterial3D from raw Godot property strings, as a derived material or as the
 * `.tres` text a scene references. Build-excluded through the `src/**\/testing/**`
 * tsconfig rule (test-only).
 */

import type * as THREE from 'three';
import { materialFromBag } from '../build';
import { standardMaterialBag } from '../materialBag';
import { parseStandardMaterial3DScalars } from '../scalars';

export function standardMaterial(properties: Record<string, string> = {}): THREE.Material {
  return materialFromBag(standardMaterialBag(parseStandardMaterial3DScalars(properties)));
}

/**
 * The `.tres` text Godot writes for these properties. A test parses it itself, since only
 * the loading layer value-imports the parser (`resourceSliceIsolation.test.ts`).
 */
export function standardMaterialTres(properties: Record<string, string> = {}): string {
  const lines = Object.entries(properties).map(([key, value]) => `${key} = ${value}\n`);
  return `[gd_resource type="StandardMaterial3D" format=3]\n\n[resource]\n${lines.join('')}`;
}
