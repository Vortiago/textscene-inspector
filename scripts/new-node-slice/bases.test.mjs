/**
 * The scaffold's `invisibleBase` flag against the runtime marker. The registry refuses a
 * `pending` slice on an unmarked component, so a flag that disagrees scaffolds a slice that
 * throws on load, or one that registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import { isInvisibleBase } from '../../packages/textscene-core/src/r3f/invisibleBase.ts';
import { BASES, GEOMETRY_INSTANCE_BASE } from './bases.mjs';
import { NODES_ROOT } from './paths.mjs';

/**
 * Importing the node2d Component evaluates its whole render graph (react-three-fiber and the 2D
 * lighting): 0.85 s alone, and over the 5 s default when 235 workers share the machine.
 */
const COMPONENT_IMPORT_TIMEOUT_MS = 30_000;

const bases = [...Object.entries(BASES), ['geometryInstance', GEOMETRY_INSTANCE_BASE]];

describe('invisibleBase in bases.mjs', () => {
  it.each(bases)(
    'agrees with the marker on the %s base component',
    async (_key, base) => {
      const module = await import(join(NODES_ROOT, base.dir, 'Component.tsx'));
      expect(isInvisibleBase(module[base.component])).toBe(base.invisibleBase);
    },
    COMPONENT_IMPORT_TIMEOUT_MS
  );
});
