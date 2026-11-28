/**
 * What a sub-viewport's pass renders by: its update gate, its clear mode, and the renders of its
 * target, which live as long as the pass and the parsed scene.
 */
import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import { propertyWriteRevision } from '../../scene/writtenScene.js';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import { perObject } from '../../utils/perObject.js';
import { TargetRenderState } from './renderGate.js';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types.js';
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

/** The scope of a viewport that no parsed scene holds, as in a test that mounts one alone. */
const NO_SCENE = {};

/**
 * The renders of each mounted viewport pass, by parsed scene, then by the pass that owns them. Read
 * only by `useViewportRenderState`, and collected with the scene graph or the pass.
 */
const renderStatesOf = perObject((_scene: object) => perObject((_pass: object) => new TargetRenderState()));

/**
 * The renders of one viewport pass's target, which a resize leaves as they are
 * (`renderer_viewport.cpp:920`). They live as long as the pass and its target: a remount makes a new
 * target, so it makes new renders. A new parse of the scene makes a new viewport, so a new scene graph
 * makes new renders too. A new update mode arms a ONCE pass again (`viewport.cpp:5475-5478`).
 */
export function useViewportRenderState(path: string, updateMode: number): TargetRenderState {
  const hierarchy = useOptionalHierarchy();
  const scene = hierarchy?.sceneGraph ?? NO_SCENE;
  const host = hierarchy?.scene;
  const subscribe = host?.subscribe ?? subscribeToNothing;
  const revision = (property: string) => propertyWriteRevision(host?.written() ?? null, path, property);
  const update = useSyncExternalStore(subscribe, () => revision('render_target_update_mode'));
  const clear = useSyncExternalStore(subscribe, () => revision('render_target_clear_mode'));
  const [pass] = useState(() => ({}));
  const state = renderStatesOf(scene)(pass);
  useLayoutEffect(() => state.rearm(), [state, updateMode, update]);
  useLayoutEffect(() => state.rearmClear(), [state, clear]);
  return state;
}
