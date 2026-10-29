import { resolveGradient } from './decode';
import { resolveOnlySubResource } from '../../../testing/subResource';
import { NO_FILES } from '../../testing/loadedFiles';
import type { Gradient } from './types';

/** The Gradient a sub-resource with this property bag decodes to. */
export function gradientOf(data: Record<string, string>): Gradient {
  return resolveOnlySubResource('Gradient', data, (ref, internalResources) =>
    resolveGradient(ref, { internalResources, externalResources: [] }, NO_FILES)
  )!;
}
