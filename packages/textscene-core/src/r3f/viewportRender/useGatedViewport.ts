/**
 * What a sub-viewport's pass renders by: its update gate, its clear mode, and the renders of its
 * target, which live as long as the pass and the parsed scene.
 */
import { useLayoutEffect, useState } from 'react';
import { useOptionalHierarchy } from '../contexts/HierarchyContext.js';
import type { Scene } from '../../scene/openScene.js';
import { propertyWriteRevision } from '../../scene/writeRevisions.js';
import { useSceneSnapshot } from '../hooks/useSceneSnapshot.js';
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

function useSetterRevision(host: Scene | undefined, path: string, property: string): number {
  return useSceneSnapshot(host, (scene) => propertyWriteRevision(scene.written(), path, property), 0);
}

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
  const update = useSetterRevision(host, path, 'render_target_update_mode');
  const clear = useSetterRevision(host, path, 'render_target_clear_mode');
  const [pass] = useState(() => ({}));
  const state = renderStatesOf(scene)(pass);
  useLayoutEffect(() => state.rearm(), [state, updateMode, update]);
  useLayoutEffect(() => state.rearmClear(), [state, clear]);
  return state;
}
