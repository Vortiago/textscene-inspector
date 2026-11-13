/** A StandardMaterial3D's scalars straight from its properties, as a test writes them. */
import { decodeStandardMaterial3D } from './decode';
import { standardMaterial3DScalars } from './scalars';
import type { StandardMaterial3DScalars } from './types';

export function parseStandardMaterial3DScalars(
  properties: Record<string, string>
): StandardMaterial3DScalars {
  return standardMaterial3DScalars(decodeStandardMaterial3D(properties));
}
