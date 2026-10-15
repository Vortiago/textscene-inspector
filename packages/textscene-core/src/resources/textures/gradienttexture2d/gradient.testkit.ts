import { resolveGradient } from './decode';
import { resolveOnlySubResource } from '../../../testing/subResource';
import type { Gradient } from './types';

/** The Gradient a sub-resource with this property bag decodes to. */
export function gradientOf(data: Record<string, string>): Gradient {
  return resolveOnlySubResource('Gradient', data, resolveGradient)!;
}
