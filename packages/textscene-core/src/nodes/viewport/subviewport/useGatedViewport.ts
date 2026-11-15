/**
 * What a sub-viewport's pass renders by: its update gate, its clear mode, and the renders of its
 * target, which live as long as the scene the viewport belongs to.
 */
import { useEffect, useState } from 'react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { useOptionalHierarchy } from '../../../r3f/contexts/HierarchyContext.js';
import { perObject } from '../../../utils/perObject.js';
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
  const renderState = useViewportRenderState(path, gate.updateMode);
  return { gate, clearMode: properties.render_target_clear_mode, renderState };
}

/** The renders of each viewport of one parsed scene, by path. Written only by `renderStateOf`, and collected with the scene graph. */
const renderStatesOf = perObject((_sceneGraph: SceneGraph) => new Map<string, TargetRenderState>());

/** The renders of the viewport at `path` in `sceneGraph`, made on the first ask. */
function renderStateOf(sceneGraph: SceneGraph, path: string): TargetRenderState {
  const states = renderStatesOf(sceneGraph);
  let state = states.get(path);
  if (!state) {
    state = new TargetRenderState();
    states.set(path, state);
  }
  return state;
}

/**
 * The renders of the viewport at `path`, which a resize of its target and a remount leave as they are
 * (`renderer_viewport.cpp:920`). A new parse of the scene makes a new viewport, so a new scene graph
 * makes a new state. A new update mode arms a ONCE pass again (`viewport.cpp:5475-5478`). With no
 * scene graph, as in a test that mounts a viewport alone, the state lives as long as the component.
 */
export function useViewportRenderState(path: string, updateMode: number): TargetRenderState {
  const sceneGraph = useOptionalHierarchy()?.sceneGraph ?? null;
  const [ownState] = useState(() => new TargetRenderState());
  const state = sceneGraph ? renderStateOf(sceneGraph, path) : ownState;
  useEffect(() => state.rearm(), [state, updateMode]);
  return state;
}
