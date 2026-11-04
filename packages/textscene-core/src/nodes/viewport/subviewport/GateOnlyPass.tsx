/**
 * The registration of a sub-viewport with nothing to draw. It renders no target, and still gates the
 * WHEN_PARENT_VISIBLE passes inside it, as a Godot viewport does whatever it holds.
 */
import { useEffect, useMemo } from 'react';

import {
  useRegisterViewportPass,
  type ViewportPass,
} from '../../../r3f/contexts/ViewportPassRegistryContext.js';
import { BLACK, passGate } from '../renderGate.js';
import type { SubViewportProperties } from './types.js';
import { useGatedViewport } from './useGatedViewport.js';
import type { TscnNode } from '../../../parser/types.js';

export function GateOnlyPass({ path, node }: { path: string; node: TscnNode }): null {
  const { gate, clearMode, renderState } = useGatedViewport(path, node.properties as SubViewportProperties);
  const register = useRegisterViewportPass();
  const pass = useMemo<ViewportPass>(
    () => ({
      dependsOn: [],
      render: () => void renderState.takeRender(clearMode, BLACK),
      gate: passGate(gate, renderState),
    }),
    [gate, renderState, clearMode]
  );
  useEffect(() => register(path, pass), [register, path, pass]);
  return null;
}
