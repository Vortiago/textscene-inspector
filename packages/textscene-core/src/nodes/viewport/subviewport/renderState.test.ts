/** The renders of a viewport live as long as its scene: a remount keeps them, a new parse does not. */
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import type { SceneGraph } from '../../../core/SceneGraph.js';
import { HierarchyProvider } from '../../../r3f/contexts/HierarchyContext.js';
import { useViewportRenderState } from './useGatedViewport.js';

const PATH = '/root/Viewport';
const ALWAYS = 4;
const ONCE = 1;

/** A parsed scene: only its identity keys the renders. */
const parsedScene = () => ({}) as SceneGraph;

function inScene(sceneGraph: SceneGraph) {
  return ({ children }: { children: ReactNode }) =>
    createElement(HierarchyProvider, { value: { sceneGraph, panelId: 'panel' }, children });
}

describe('useViewportRenderState', () => {
  it('keeps the renders of a viewport that remounts in the same scene', () => {
    const wrapper = inScene(parsedScene());
    const first = renderHook(() => useViewportRenderState(PATH, ALWAYS), { wrapper });
    const state = first.result.current;
    first.unmount();

    const second = renderHook(() => useViewportRenderState(PATH, ALWAYS), { wrapper });

    expect(second.result.current).toBe(state);
  });

  it('starts new renders for a new parse of the scene', () => {
    const first = renderHook(() => useViewportRenderState(PATH, ALWAYS), { wrapper: inScene(parsedScene()) });
    const second = renderHook(() => useViewportRenderState(PATH, ALWAYS), {
      wrapper: inScene(parsedScene()),
    });

    expect(second.result.current).not.toBe(first.result.current);
  });

  it('arms a ONCE pass again when the update mode changes', () => {
    const hook = renderHook(({ mode }) => useViewportRenderState(PATH, mode), {
      wrapper: inScene(parsedScene()),
      initialProps: { mode: ONCE },
    });
    hook.result.current.takeRender(0, new THREE.Color());
    expect(hook.result.current.hasRendered).toBe(true);

    hook.rerender({ mode: ALWAYS });

    expect(hook.result.current.hasRendered).toBe(false);
  });
});
