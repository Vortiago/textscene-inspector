/** SeparationRayShape2D decode: property bag in, ray length out. The setter validates nothing. */

import { floatOr } from '../../../parser/valueParsers';
import type { SeparationRayShape2DProperties } from './types';

export function decodeSeparationRayShape2D(
  properties: Record<string, string>
): SeparationRayShape2DProperties {
  return { length: floatOr(properties.length, 20, 'SeparationRayShape2D length') };
}
