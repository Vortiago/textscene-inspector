import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { CLICK_TRAVEL_PX, useViewportSelection } from './useViewportSelection';
import { clickWith, type Click } from './viewportClicks.testkit';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { SelectionProvider, useSelectedNodePath, useSelection } from '../contexts/SelectionContext';

function wrap({ children }: { children: ReactNode }) {
  return (
    <HierarchyProvider value={{ sceneGraph: null, panelId: 'p' }}>
      <SelectionProvider>{children}</SelectionProvider>
    </HierarchyProvider>
  );
}

function setup() {
  return renderHook(
    () => ({ vp: useViewportSelection(), sel: useSelection(), selected: useSelectedNodePath() }),
    { wrapper: wrap }
  );
}

type View = ReturnType<typeof setup>;

/** Registers a fresh Object3D at `path`, as a node component does. */
function registerObjectAt({ result }: View, path: string): THREE.Object3D {
  const object = new THREE.Object3D();
  act(() => result.current.sel.registerNodeObject(path, object));
  return object;
}

function click({ result }: View, how: Click) {
  act(() => clickWith(result.current.vp.handlers, how));
}

describe('useViewportSelection', () => {
  it('selects the node a click lands on', () => {
    const view = setup();

    click(view, { on: registerObjectAt(view, 'Root/Mesh') });

    expect(view.result.current.selected).toBe('Root/Mesh');
  });

  it('selects the node of a click that moves up to the click travel', () => {
    const view = setup();

    click(view, { on: registerObjectAt(view, 'Root/Mesh'), travel: CLICK_TRAVEL_PX });

    expect(view.result.current.selected).toBe('Root/Mesh');
  });

  it('selects nothing for a press and release past the click travel, which orbits', () => {
    const view = setup();

    click(view, { on: registerObjectAt(view, 'Root/Mesh'), travel: CLICK_TRAVEL_PX + 1 });

    expect(view.result.current.selected).toBeNull();
  });

  it('clears the selection on a click on nothing that moves up to the click travel', () => {
    const view = setup();
    click(view, { on: registerObjectAt(view, 'Root/Mesh') });

    click(view, { on: null, travel: CLICK_TRAVEL_PX });

    expect(view.result.current.selected).toBeNull();
  });

  it('keeps the selection through an orbit that starts on nothing', () => {
    const view = setup();
    click(view, { on: registerObjectAt(view, 'Root/Mesh') });

    click(view, { on: null, travel: CLICK_TRAVEL_PX + 1 });

    expect(view.result.current.selected).toBe('Root/Mesh');
  });

  it('clears the selection on a click on an object of no node, such as the empty-state grid', () => {
    const view = setup();
    click(view, { on: registerObjectAt(view, 'Root/Mesh') });

    click(view, { on: new THREE.Object3D() });

    expect(view.result.current.selected).toBeNull();
  });

  it('selects the node of a mesh nested under its wrapper', () => {
    const view = setup();
    const mesh = new THREE.Mesh();
    registerObjectAt(view, 'Root/MeshInstance3D').add(mesh);

    click(view, { on: mesh });

    expect(view.result.current.selected).toBe('Root/MeshInstance3D');
  });

  it('returns the same handlers object across renders, for one delegated root', () => {
    const { result, rerender } = setup();
    const first = result.current.vp.handlers;
    rerender();
    expect(result.current.vp.handlers).toBe(first);
  });
});
