/**
 * The `ENVIRONMENT` kind: an Environment's properties, from any origin, with its Sky and its
 * `glow_map` as references in the Environment's own file. The sky is a reference, not a read, so
 * the settings apply while a sky file still loads (**Progressive fill-in**). No THREE.
 */

import { optionalReference, type ResourceKind, type ScopedReference } from '../reading';
import { decodeEnvironment } from './decode';
import type { EnvironmentProperties } from './types';

export interface DecodedEnvironment {
  readonly properties: EnvironmentProperties;
  /** Null when the Environment names no Sky. */
  readonly sky: ScopedReference | null;
  /** Null when it names no `glow_map`. */
  readonly glowMap: ScopedReference | null;
}

export const ENVIRONMENT: ResourceKind<DecodedEnvironment> = {
  name: 'Environment',
  accepts: (type) => type === 'Environment',
  decode: ({ properties }, follow) => {
    const decoded = decodeEnvironment(properties);
    return {
      properties: decoded,
      sky: optionalReference(follow, decoded.sky),
      glowMap: optionalReference(follow, decoded.glow_map),
    };
  },
};
