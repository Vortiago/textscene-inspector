import { resolveGradient } from './decode';
import type { Gradient } from './types';

/** The Gradient a sub-resource with this property bag decodes to. */
export function gradientOf(data: Record<string, string>): Gradient {
  return resolveGradient('SubResource("gradient")', [{ id: 'gradient', type: 'Gradient', data }])!;
}
