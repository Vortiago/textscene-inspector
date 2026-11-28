import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { propertyWriteRevision } from '../../scene/writtenScene';
import { openScene } from '../../scene/openScene';
import { SubViewportClearMode, SubViewportUpdateMode } from '../../godot/scene/viewport';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { useViewportRenderState } from './useGatedViewport';

const SOURCE = `[gd_scene format=3]
[node name="Root" type="Node"]
[node name="Window" type="SubViewport" parent="."]
render_target_update_mode = 1
render_target_clear_mode = 2
[node name="Other" type="SubViewport" parent="."]
render_target_update_mode = 1
render_target_clear_mode = 2
`;

async function spentPass() {
  const scene = openScene({ source: SOURCE, provider: { loadResource: async () => null } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TscnSceneProvider scene={scene}>{children}</TscnSceneProvider>
  );
  const { result } = renderHook(() => useViewportRenderState('Root/Window', SubViewportUpdateMode.ONCE), {
    wrapper,
  });
  const clear = () => result.current.takeRender(SubViewportClearMode.ONCE, new Color()).clears;
  expect(clear()).toBe(true);
  expect(clear()).toBe(false);
  expect(result.current.hasRendered).toBe(true);
  return { scene, result, clear };
}

describe('a spent viewport pass', () => {
  it('keeps each written snapshot independent and starts a new source with fresh state', async () => {
    const { scene, result } = await spentPass();
    const property = 'render_target_update_mode';
    await act(async () => {
      await scene.getNode('Window').set(property, SubViewportUpdateMode.ONCE);
    });
    const first = scene.written();
    await act(async () => {
      await scene.getNode('Window').set(property, SubViewportUpdateMode.ONCE);
    });
    const second = scene.written();
    result.current.takeRender(SubViewportClearMode.ONCE, new Color());
    await act(async () => {
      scene.setSource(SOURCE + '\n');
    });
    expect(result.current.hasRendered).toBe(false);
    const revision = (graph: typeof first) => propertyWriteRevision(graph, 'Root/Window', property);
    expect([first, second, scene.written()].map(revision)).toEqual([1, 2, 0]);
  });

  it('draws once when the host sets the same update mode again', async () => {
    const { scene, result, clear } = await spentPass();
    await act(async () => {
      await scene.getNode('Window').set('render_target_update_mode', SubViewportUpdateMode.ONCE);
    });
    expect(result.current.hasRendered).toBe(false);
    expect(clear()).toBe(false);
  });

  it('clears once when the host sets the same clear mode again', async () => {
    const { scene, result, clear } = await spentPass();
    await act(async () => {
      await scene.getNode('Window').set('render_target_clear_mode', SubViewportClearMode.ONCE);
    });
    expect(result.current.hasRendered).toBe(true);
    expect(clear()).toBe(true);
    expect(clear()).toBe(false);
  });

  it.each([
    ['Window', 'transparent_bg', true],
    ['Other', 'render_target_update_mode', SubViewportUpdateMode.ONCE],
    ['Other', 'render_target_clear_mode', SubViewportClearMode.ONCE],
  ] as const)('keeps both modes spent when the host sets %s.%s', async (path, property, value) => {
    const { scene, result, clear } = await spentPass();
    await act(async () => {
      await scene.getNode(path).set(property, value);
    });
    expect(result.current.hasRendered).toBe(true);
    expect(clear()).toBe(false);
  });
});
