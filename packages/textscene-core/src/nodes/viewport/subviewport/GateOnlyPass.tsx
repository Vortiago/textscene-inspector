/**
 * The registration of a sub-viewport with nothing to draw. It renders no target, and still gates the
 * WHEN_PARENT_VISIBLE passes inside it, as a Godot viewport does whatever it holds.
 */
import { useEffect, useMemo } from 'react';

import {
  useRegisterViewportPass,
  type ViewportPass,
} from '../../../r3f/contexts/ViewportPassRegistryContext.js';
import { BLACK, TargetRenderState } from '../renderGate.js';
import type { SubViewportProperties } from './types.js';
import { useViewportGate } from './useViewportGate.js';
import type { TscnNode } from '../../../parser/types.js';

export function GateOnlyPass({ path, node }: { path: string; node: TscnNode }): null {
  const properties = node.properties as SubViewportProperties;
  const gate = useViewportGate(path, properties.render_target_update_mode);
  const register = useRegisterViewportPass();
  const state = useMemo(() => new TargetRenderState(), []);
  const clearMode = properties.render_target_clear_mode;
  const pass = useMemo<ViewportPass>(
    () => ({
      dependsOn: [],
      render: () => void state.takeRender(clearMode, BLACK),
      gate: { ...gate, state, isSampled: () => false, restart: () => state.restart() },
    }),
    [gate, state, clearMode]
  );
  useEffect(() => register(path, pass), [register, path, pass]);
  return null;
}
