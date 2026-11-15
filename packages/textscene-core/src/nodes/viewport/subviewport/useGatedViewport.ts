/**
 * What a sub-viewport's pass renders by: its update gate, its clear mode, and the renders of its
 * target, which live as long as the scene the viewport belongs to.
 */
import { useEffect, useMemo } from 'react';

import { useOptionalHierarchy } from '../../../r3f/contexts/HierarchyContext.js';
import { TargetRenderState } from '../renderGate.js';
import type { SubViewportProperties } from './types.js';
import { useViewportGate } from './useViewportGate.js';
import type { UpdateGate } from './viewportGate.js';

interface GatedViewport {
  gate: UpdateGate;
  clearMode: number;
  renderState: TargetRenderState;
}

export function useGatedViewport(path: string, properties: SubViewportProperties): GatedViewport {
  const gate = useViewportGate(path, properties.render_target_update_mode);
  const renderState = useViewportRenderState(gate.updateMode);
  return { gate, clearMode: properties.render_target_clear_mode, renderState };
}

/**
 * The renders of one viewport, which a resize of its target leaves as they are (`renderer_viewport.cpp:920`).
 * A new parse of the scene makes a new viewport, so a new scene graph makes a new state. A new update
 * mode arms a ONCE pass again (`viewport.cpp:5475-5478`).
 */
export function useViewportRenderState(updateMode: number): TargetRenderState {
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the scene graph keys the state's lifetime.
  const state = useMemo(() => new TargetRenderState(), [sceneGraph]);
  useEffect(() => state.rearm(), [state, updateMode]);
  return state;
}
