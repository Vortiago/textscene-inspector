/** The renders of a viewport live as long as its pass's target and its parsed scene. */
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { HierarchyProvider } from '../../../r3f/contexts/HierarchyContext.js';
import { SubViewportClearMode, SubViewportUpdateMode } from '../../../godot/scene/viewport.js';
import type { TargetRenderState } from '../renderGate.js';
import { useViewportRenderState } from './useGatedViewport.js';

const PROJECT_CLEAR = new THREE.Color(0.3, 0.3, 0.3);

/** A parsed scene: only its identity keys the renders. */
const parsedScene = () => ({}) as SceneGraph;

/** A wrapper that provides whichever scene `current` holds at each render. */
function inScenes(current: { scene: SceneGraph }) {
  return ({ children }: { children: ReactNode }) =>
    createElement(HierarchyProvider, { value: { sceneGraph: current.scene, panelId: 'panel' }, children });
}

const takesOnceClear = (state: TargetRenderState) =>
  state.takeRender(SubViewportClearMode.ONCE, PROJECT_CLEAR).clears;

describe('useViewportRenderState', () => {
  it('keeps the renders across a re-render of the same pass', () => {
    const wrapper = inScenes({ scene: parsedScene() });
    const hook = renderHook(() => useViewportRenderState(SubViewportUpdateMode.ALWAYS), { wrapper });
    const state = hook.result.current;

    hook.rerender();

    expect(hook.result.current).toBe(state);
  });

  it('clears the new target of a remounted pass under a ONCE clear', () => {
    const wrapper = inScenes({ scene: parsedScene() });
    const first = renderHook(() => useViewportRenderState(SubViewportUpdateMode.ALWAYS), { wrapper });
    takesOnceClear(first.result.current);
    first.unmount();

    const second = renderHook(() => useViewportRenderState(SubViewportUpdateMode.ALWAYS), { wrapper });

    expect(takesOnceClear(second.result.current)).toBe(true);
  });

  it('starts new renders when a new parse replaces the scene under a mounted pass', () => {
    const current = { scene: parsedScene() };
    const hook = renderHook(() => useViewportRenderState(SubViewportUpdateMode.ALWAYS), {
      wrapper: inScenes(current),
    });
    takesOnceClear(hook.result.current);

    current.scene = parsedScene();
    hook.rerender();

    expect(takesOnceClear(hook.result.current)).toBe(true);
  });

  it('arms a ONCE pass again when the update mode changes', () => {
    const hook = renderHook(({ mode }) => useViewportRenderState(mode), {
      wrapper: inScenes({ scene: parsedScene() }),
      initialProps: { mode: SubViewportUpdateMode.ONCE as number },
    });
    hook.result.current.takeRender(SubViewportClearMode.ALWAYS, PROJECT_CLEAR);
    expect(hook.result.current.hasRendered).toBe(true);

    hook.rerender({ mode: SubViewportUpdateMode.ALWAYS });

    expect(hook.result.current.hasRendered).toBe(false);
  });
});
